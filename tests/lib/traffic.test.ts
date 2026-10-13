import { describe, it, expect } from "vitest";
import { classifyAgent, isLoggableBot } from "@/lib/traffic/classify";
import { apiKeyPrefix, buildRecord, clientCountry, hashIp, redactQuery } from "@/lib/traffic/log";

describe("classifyAgent", () => {
  it.each([
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)", "GPTBot", "ai"],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", "ClaudeBot", "ai"],
    ["Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", "PerplexityBot", "ai"],
    ["Mozilla/5.0 (compatible; Applebot-Extended/0.1)", "Applebot-Extended", "ai"],
    ["Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Googlebot", "search"],
    ["Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "Bingbot", "search"],
    ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "Facebook", "social"],
    ["Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)", "AhrefsBot", "seo"],
    ["Mozilla/5.0 (compatible; GoogleDocs; apps-spreadsheets; +http://docs.google.com)", "Google Sheets", "tool"],
    ["curl/8.7.1", "curl", "tool"],
    ["python-requests/2.32.3", "Python", "tool"],
    ["node", "Node.js", "tool"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", "Browser", "browser"],
    ["SomeRandomCrawler/1.0", "Altro bot", "bot"],
  ])("%s → %s", (ua, agent, kind) => {
    expect(classifyAgent(ua)).toEqual({ agent, kind });
  });

  it("gestisce user agent assente", () => {
    expect(classifyAgent(null).kind).toBe("other");
    expect(classifyAgent("").kind).toBe("other");
  });

  it("registra sulle pagine solo i bot, non browser e script", () => {
    expect(isLoggableBot("ai")).toBe(true);
    expect(isLoggableBot("search")).toBe(true);
    expect(isLoggableBot("browser")).toBe(false);
    expect(isLoggableBot("tool")).toBe(false);
  });
});

describe("traffic log record", () => {
  it("toglie la chiave API dalla querystring", () => {
    expect(redactQuery(new URLSearchParams("format=csv&key=eidx_live_secret123456"))).toBe("format=csv&key=REDACTED");
    expect(redactQuery(new URLSearchParams(""))).toBeNull();
  });

  it("tiene solo il prefisso della chiave", () => {
    const h = new Headers({ authorization: "Bearer eidx_live_abcdefghijklmnop" });
    expect(apiKeyPrefix(h, new URLSearchParams())).toBe("eidx_live_abcd");
    expect(apiKeyPrefix(new Headers(), new URLSearchParams("key=eidx_live_zzzz9999"))).toBe("eidx_live_zzzz");
    expect(apiKeyPrefix(new Headers(), new URLSearchParams())).toBeNull();
  });

  it("legge il paese da x-country o da x-nf-geo", () => {
    expect(clientCountry(new Headers({ "x-country": "it" }))).toBe("IT");
    const geo = btoa(JSON.stringify({ country: { code: "de", name: "Germany" } }));
    expect(clientCountry(new Headers({ "x-nf-geo": geo }))).toBe("DE");
    expect(clientCountry(new Headers())).toBeNull();
  });

  it("l'hash IP e' stabile nel giorno e cambia il giorno dopo", async () => {
    const d1 = new Date("2026-09-27T10:00:00Z");
    const d1b = new Date("2026-09-27T18:00:00Z");
    const d2 = new Date("2026-09-28T10:00:00Z");
    const a = await hashIp("1.2.3.4", "salt", d1);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await hashIp("1.2.3.4", "salt", d1b)).toBe(a);
    expect(await hashIp("1.2.3.4", "salt", d2)).not.toBe(a);
    expect(await hashIp(null, "salt")).toBeNull();
  });

  it("costruisce il record completo", async () => {
    const r = await buildRecord(
      "api",
      {
        method: "GET",
        headers: new Headers({
          "user-agent": "curl/8.7.1",
          origin: "https://blog.example.it",
          "x-nf-client-connection-ip": "5.6.7.8",
          "x-country": "IT",
        }),
        nextUrl: { pathname: "/api/v1/pun/today", searchParams: new URLSearchParams("x=1") },
      },
      "salt",
    );
    expect(r).toMatchObject({
      kind: "api",
      path: "/api/v1/pun/today",
      query: "x=1",
      origin_host: "blog.example.it",
      agent: "curl",
      agent_kind: "tool",
      country: "IT",
      api_key_prefix: null,
    });
    expect(r.ip_hash).toMatch(/^[0-9a-f]{16}$/);
  });
});
