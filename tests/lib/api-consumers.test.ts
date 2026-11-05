/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { aggregateConsumers, consumerSite, type IdentifiedCall } from "@/lib/admin/api-consumers";

const call = (over: Partial<IdentifiedCall>): IdentifiedCall => ({
  ts: "2026-11-05T10:00:00+00:00",
  path: "/api/v1/pun/today",
  query: null,
  origin_host: null,
  referer_host: null,
  api_key_prefix: null,
  ip_hash: "a",
  ...over,
});

describe("consumerSite", () => {
  it("unisce www e dominio nudo", () => {
    expect(consumerSite("www.marcopadulano.it")).toBe("marcopadulano.it");
    expect(consumerSite("marcopadulano.it")).toBe("marcopadulano.it");
  });
  it("unisce le anteprime Vercel dello stesso progetto", () => {
    expect(consumerSite("fastweb-energia-auto-55mri2zrt-fcampi96-dot.vercel.app")).toBe("fastweb-energia-auto.vercel.app");
    expect(consumerSite("fastweb-energia-auto.vercel.app")).toBe("fastweb-energia-auto.vercel.app");
  });
  it("esclude i nostri host e le prove in locale", () => {
    for (const h of ["energyindex.it", "www.energyindex.pro", "energyindex.netlify.app", "abc--energyindex.netlify.app", "127.0.0.1:13863", "localhost:3000"]) {
      expect(consumerSite(h)).toBeNull();
    }
  });
});

describe("aggregateConsumers", () => {
  const rows = [
    call({ origin_host: "www.casadocimmobiliare.it", ip_hash: "a", ts: "2026-11-05T09:00:00+00:00" }),
    call({ origin_host: "www.casadocimmobiliare.it", ip_hash: "b", path: "/api/v1/psv/today", ts: "2026-11-05T15:00:00+00:00" }),
    call({ origin_host: "marcopadulano.it", ip_hash: "c" }),
    call({ origin_host: "www.marcopadulano.it", ip_hash: "c", path: "/api/v1/psv/today" }),
    call({ origin_host: "www.marcopadulano.it", ip_hash: "d" }),
    call({ referer_host: "blog.esempio.it", query: "src=widget&commodity=luce", path: "/api/v1/energy-index" }),
    call({ api_key_prefix: "eidx_live_ab12", origin_host: "esempio.it" }),
    call({ referer_host: "energyindex.it" }),
    call({ origin_host: "127.0.0.1:13863" }),
  ];
  const out = aggregateConsumers(rows);
  const site = (n: string) => out.find((c) => c.name === n)!;

  it("raggruppa per sito e ordina per chiamate", () => {
    expect(out[0].name).toBe("marcopadulano.it");
    expect(site("marcopadulano.it").requests).toBe(3);
    expect(site("casadocimmobiliare.it").requests).toBe(2);
  });

  it("conta i visitatori distinti, gli endpoint e l'ultima chiamata", () => {
    const m = site("marcopadulano.it");
    expect(m.visitors).toBe(2);
    expect(m.endpoints).toEqual([{ path: "/pun/today", requests: 2 }, { path: "/psv/today", requests: 1 }]);
    expect(site("casadocimmobiliare.it").lastSeen).toBe("2026-11-05T15:00:00+00:00");
    expect(site("casadocimmobiliare.it").firstSeen).toBe("2026-11-05T09:00:00+00:00");
  });

  it("distingue sito, widget e chiave", () => {
    expect(site("casadocimmobiliare.it").kind).toBe("sito");
    expect(site("blog.esempio.it").kind).toBe("widget");
    expect(site("eidx_live_ab12").kind).toBe("chiave");
  });

  it("non mostra i nostri host ne' le prove in locale", () => {
    expect(out.map((c) => c.name)).not.toContain("energyindex.it");
    expect(out.map((c) => c.name)).not.toContain("127.0.0.1:13863");
    expect(out).toHaveLength(4);
  });
});
