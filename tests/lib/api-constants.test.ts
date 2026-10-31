/**
 * @vitest-environment node
 *
 * Il limite al minuto per piano vive in tre posti: la funzione SQL che
 * calcola il throttle, l'header X-RateLimit-Limit del gate e la tabella dei
 * piani pubblicata. Questo test li tiene allineati.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { RATE_PER_MINUTE } from "@/lib/api-keys/gate";
import { TIERS } from "@/lib/api/catalog";

const MIGRATION = join(process.cwd(), "supabase/migrations/20261031000001_api_keys_throttle.sql");
const PLANS = ["open", "developer", "api", "pro", "trading"] as const;

/** Legge il CASE di api_plan_rate_per_minute(): ELSE vale per il piano open. */
function sqlRates(): Record<string, number> {
  const sql = readFileSync(MIGRATION, "utf8");
  const fn = sql.match(/FUNCTION api_plan_rate_per_minute\b[\s\S]*?\$\$([\s\S]*?)\$\$/)?.[1];
  if (!fn) throw new Error("api_plan_rate_per_minute non trovata nella migrazione");
  const rates: Record<string, number> = {};
  for (const [, plan, n] of fn.matchAll(/WHEN '(\w+)' THEN (\d+)/g)) rates[plan] = Number(n);
  const fallback = fn.match(/ELSE (\d+)/)?.[1];
  if (fallback) rates.open = Number(fallback);
  return rates;
}

/** "1.200 richieste/minuto" → 1200. */
function tierRate(id: string): number {
  const tier = TIERS.find((t) => t.id === id);
  const n = tier?.rateLimit.match(/^([\d.]+) richieste\/minuto/)?.[1];
  if (!n) throw new Error(`rateLimit non numerico per ${id}: ${tier?.rateLimit}`);
  return Number(n.replace(/\./g, ""));
}

describe("limiti al minuto per piano", () => {
  const sql = sqlRates();

  it.each(PLANS)("%s: SQL, gate e catalogo coincidono", (plan) => {
    expect(sql[plan]).toBeTypeOf("number");
    expect(RATE_PER_MINUTE[plan]).toBe(sql[plan]);
    expect(tierRate(plan)).toBe(sql[plan]);
  });

  it("enterprise: SQL e gate coincidono", () => {
    expect(RATE_PER_MINUTE.enterprise).toBe(sql.enterprise);
  });
});
