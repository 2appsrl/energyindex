/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ENDPOINTS, GME_FREE_NOTICE, TIERS, tierIncludes } from "@/lib/api/catalog";
import { GME_PATH_PATTERN } from "@/lib/api-keys/gate";

const GME_ENDPOINTS = ["today", "pun-today", "psv-today", "prices-series", "pun-zones", "pun-hourly"];
const PAID = TIERS.filter((t) => t.priceMonthlyEur !== 0);

describe("PUN e PSV non sono in vendita", () => {
  it.each(GME_ENDPOINTS)("%s e' in un piano gratuito", (id) => {
    const e = ENDPOINTS.find((x) => x.id === id)!;
    expect(tierIncludes("developer", e.tier)).toBe(true);
  });

  it("lo storico completo e' nel piano Developer gratuito", () => {
    expect(TIERS.find((t) => t.id === "developer")!.history).toBe("Storico completo");
    const series = ENDPOINTS.find((x) => x.id === "prices-series")!;
    expect(series.tierLimits?.developer).toMatch(/Storico completo/);
    expect(series.tierLimits?.api).toBeUndefined();
  });

  it("nessun piano a pagamento promette dati GME come vantaggio", () => {
    for (const t of PAID) {
      for (const f of t.features) expect(f).not.toMatch(/PUN orario|storico completo/i);
    }
  });

  it("l'export bulk non contiene dati GME", () => {
    const bulk = ENDPOINTS.find((x) => x.id === "bulk-export")!;
    const datasets = bulk.params.find((p) => p.name === "dataset")!.enum!;
    expect(datasets).not.toContain("pun-hourly");
    expect(datasets).not.toContain("prices-daily");
    expect(bulk.exampleCall).not.toMatch(/pun|prices/);
  });

  it("la formula pubblica non parla di licenze nostre e rimanda al GME", () => {
    expect(GME_FREE_NOTICE).toMatch(/non sono in vendita/);
    expect(GME_FREE_NOTICE).toMatch(/condizioni del GME/);
    expect(GME_FREE_NOTICE).not.toMatch(/licenz/i);
  });

  it("la migrazione delle quote usa lo stesso elenco di percorsi del middleware", () => {
    const sql = readFileSync("supabase/migrations/20261105000003_throttle_gme_gratis.sql", "utf8");
    expect(sql).toContain(GME_PATH_PATTERN);
    expect(sql).toMatch(/api_plan_rate_per_minute\('developer'\)/);
  });
});
