/**
 * Classificazione del client a partire dallo User-Agent.
 *
 * Usata dal middleware per decidere cosa registrare in traffic_log:
 *  - su /api/v1/* si registra tutto, con il nome del client
 *  - sulle pagine si registrano solo i bot (i visitatori umani li conta Umami)
 *
 * L'ordine delle regole conta: la prima che combacia vince. I crawler AI
 * vanno prima dei motori di ricerca perche' alcuni UA contengono entrambi
 * i nomi (es. "Googlebot" dentro "Google-InspectionTool" no, ma "Applebot"
 * dentro "Applebot-Extended" si').
 */

export type AgentKind = "ai" | "search" | "social" | "seo" | "tool" | "browser" | "bot" | "other";

export interface AgentInfo {
  agent: string;
  kind: AgentKind;
}

const RULES: readonly [RegExp, string, AgentKind][] = [
  // Crawler e fetcher AI
  [/OAI-SearchBot/i, "OAI-SearchBot", "ai"],
  [/ChatGPT-User/i, "ChatGPT-User", "ai"],
  [/GPTBot/i, "GPTBot", "ai"],
  [/Claude-SearchBot/i, "Claude-SearchBot", "ai"],
  [/Claude-User/i, "Claude-User", "ai"],
  [/ClaudeBot/i, "ClaudeBot", "ai"],
  [/anthropic-ai/i, "anthropic-ai", "ai"],
  [/Perplexity-User/i, "Perplexity-User", "ai"],
  [/PerplexityBot/i, "PerplexityBot", "ai"],
  [/Google-Extended/i, "Google-Extended", "ai"],
  [/Applebot-Extended/i, "Applebot-Extended", "ai"],
  [/meta-externalagent|meta-externalfetcher/i, "Meta AI", "ai"],
  [/MistralAI-User/i, "MistralAI-User", "ai"],
  [/DuckAssistBot/i, "DuckAssistBot", "ai"],
  [/cohere-ai/i, "cohere-ai", "ai"],
  [/YouBot/i, "YouBot", "ai"],
  [/Amazonbot/i, "Amazonbot", "ai"],
  [/Bytespider/i, "Bytespider", "ai"],
  [/CCBot/i, "CCBot", "ai"],

  // Motori di ricerca
  [/Google-InspectionTool/i, "Google-InspectionTool", "search"],
  [/GoogleOther/i, "GoogleOther", "search"],
  [/Googlebot/i, "Googlebot", "search"],
  [/bingbot/i, "Bingbot", "search"],
  [/Applebot/i, "Applebot", "search"],
  [/DuckDuckBot/i, "DuckDuckBot", "search"],
  [/YandexBot/i, "YandexBot", "search"],
  [/Baiduspider/i, "Baiduspider", "search"],
  [/SeznamBot/i, "SeznamBot", "search"],
  [/Qwantify|Qwantbot/i, "Qwant", "search"],

  // Anteprime social e messaggistica
  [/facebookexternalhit/i, "Facebook", "social"],
  [/LinkedInBot/i, "LinkedIn", "social"],
  [/Twitterbot/i, "X/Twitter", "social"],
  [/Slackbot/i, "Slack", "social"],
  [/TelegramBot/i, "Telegram", "social"],
  [/WhatsApp/i, "WhatsApp", "social"],
  [/Discordbot/i, "Discord", "social"],

  // Strumenti SEO
  [/AhrefsBot/i, "AhrefsBot", "seo"],
  [/SemrushBot/i, "SemrushBot", "seo"],
  [/MJ12bot/i, "MJ12bot", "seo"],
  [/DotBot/i, "DotBot", "seo"],
  [/Screaming Frog/i, "Screaming Frog", "seo"],

  // Client programmatici (tipici delle API)
  [/apps-spreadsheets|GoogleDocs/i, "Google Sheets", "tool"],
  [/Google-Apps-Script/i, "Google Apps Script", "tool"],
  [/Microsoft\.Data\.Mashup|PowerQuery/i, "Excel Power Query", "tool"],
  [/HomeAssistant/i, "Home Assistant", "tool"],
  [/n8n/i, "n8n", "tool"],
  [/Integromat|Make\.com/i, "Make", "tool"],
  [/Zapier/i, "Zapier", "tool"],
  [/PostmanRuntime/i, "Postman", "tool"],
  [/insomnia/i, "Insomnia", "tool"],
  [/^curl\//i, "curl", "tool"],
  [/^Wget/i, "wget", "tool"],
  [/python-requests|python-httpx|aiohttp|Python-urllib/i, "Python", "tool"],
  [/axios/i, "axios", "tool"],
  [/node-fetch|undici|^node$/i, "Node.js", "tool"],
  [/Go-http-client/i, "Go", "tool"],
  [/okhttp/i, "OkHttp", "tool"],
  [/^Java\//i, "Java", "tool"],
  [/Deno\//i, "Deno", "tool"],
  [/Bun\//i, "Bun", "tool"],

  // Bot generici non riconosciuti
  [/bot\b|crawler|spider|crawl|slurp|fetcher/i, "Altro bot", "bot"],

  // Browser
  [/Mozilla\/5\.0.*(Chrome|Safari|Firefox|Edg)\//i, "Browser", "browser"],
];

export function classifyAgent(userAgent: string | null | undefined): AgentInfo {
  const ua = (userAgent ?? "").trim();
  if (!ua) return { agent: "Senza user agent", kind: "other" };
  for (const [re, agent, kind] of RULES) {
    if (re.test(ua)) return { agent, kind };
  }
  return { agent: "Altro", kind: "other" };
}

/** Famiglie che sulle pagine (non API) vale la pena registrare. */
export function isLoggableBot(kind: AgentKind): boolean {
  return kind === "ai" || kind === "search" || kind === "social" || kind === "seo" || kind === "bot";
}

export const AGENT_KIND_LABELS: Record<AgentKind, string> = {
  ai: "AI",
  search: "Motori di ricerca",
  social: "Social",
  seo: "Strumenti SEO",
  tool: "Script e strumenti",
  browser: "Browser",
  bot: "Altri bot",
  other: "Altro",
};
