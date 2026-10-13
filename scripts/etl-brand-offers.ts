/**
 * ETL offerte online dei brand: scrape dei siti fornitori → upsert in
 * mercato_libero_offers con source='scraping_brand_site'.
 *
 * Flow (mirror di etl-energiapro-offers):
 *  1. Per ogni scraper registrato: fetch pagine → parse → ScrapedOffer[]
 *  2. Upsert (conflict su source+external_id)
 *  3. Soft-delete PER BRAND: is_active=false per le righe del brand con
 *     external_id non piu' presente. Se un brand fallisce o torna 0 offerte
 *     (sito giu', layout cambiato) le sue righe NON vengono toccate.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Cron: giornaliero (vedi .github/workflows/etl-brand-offers-daily.yml).
 */
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BRAND_SCRAPERS } from "./lib/brand-scrapers";
import { fetchHtml, htmlToText, type ScrapedOffer } from "./lib/brand-scrapers/types";

const SOURCE = "scraping_brand_site" as const;

interface BrandResult {
  brand: string;
  scraped: number;
  upserted: number;
  deactivated: number;
  error: string | null;
}

function supabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function mapOfferToDbRow(
  o: ScrapedOffer,
  brand: string,
  supplier: string,
  syncedAt: Date,
): Record<string, unknown> {
  return {
    external_id: o.externalId,
    source: SOURCE,
    source_brand: brand,
    offer_code: o.offerCode,
    offer_name: o.offerName,
    supplier,
    supplier_slug: brand,
    supplier_logo_url: null,
    commodity: o.commodity,
    price_type: o.priceType,
    price_value: o.priceValue,
    price_unit: o.commodity === "electricity" ? "€/kWh" : "€/Smc",
    customer_segment: "domestico",
    valid_from: null,
    valid_to: null,
    fixed_cost_monthly: o.fixedCostMonthly,
    source_url: o.sourceUrl,
    notes: o.notes,
    last_verified_at: syncedAt.toISOString(),
    creator_role: "superadmin",
    raw: o,
    is_active: true,
    synced_at: syncedAt.toISOString(),
  };
}

export async function syncBrandOffers(): Promise<BrandResult[]> {
  const startedAt = new Date();
  const supabase = supabaseClient();
  const results: BrandResult[] = [];

  for (const scraper of BRAND_SCRAPERS) {
    const r: BrandResult = {
      brand: scraper.brand,
      scraped: 0,
      upserted: 0,
      deactivated: 0,
      error: null,
    };
    try {
      const texts = await Promise.all(
        scraper.urls.map(async (u) => htmlToText(await fetchHtml(u))),
      );
      const offers = scraper.parse(texts);
      r.scraped = offers.length;

      if (offers.length === 0) {
        // Sito giu' o layout cambiato: non disattiviamo nulla, solo log.
        console.warn(`[brand-etl] ${scraper.brand}: 0 offerte estratte — skip deactivate`);
        results.push(r);
        continue;
      }

      const rows = offers.map((o) =>
        mapOfferToDbRow(o, scraper.brand, scraper.supplier, startedAt),
      );
      const { error: upErr, count } = await supabase
        .from("mercato_libero_offers")
        .upsert(rows, { onConflict: "source,external_id", count: "exact" });
      if (upErr) throw new Error(`upsert: ${upErr.message}`);
      r.upserted = count ?? rows.length;

      const currentIds = offers.map((o) => o.externalId);
      const { error: delErr, count: delCount } = await supabase
        .from("mercato_libero_offers")
        .update({ is_active: false }, { count: "exact" })
        .eq("source", SOURCE)
        .eq("source_brand", scraper.brand)
        .eq("is_active", true)
        .not("external_id", "in", `(${currentIds.map((id) => `"${id}"`).join(",")})`);
      if (delErr) throw new Error(`soft-delete: ${delErr.message}`);
      r.deactivated = delCount ?? 0;
    } catch (e) {
      r.error = e instanceof Error ? e.message : String(e);
      console.error(`[brand-etl] ${scraper.brand}: ${r.error}`);
    }
    console.log(
      `[brand-etl] ${scraper.brand}: scraped=${r.scraped} upserted=${r.upserted} deactivated=${r.deactivated}${r.error ? ` ERROR=${r.error}` : ""}`,
    );
    results.push(r);
  }

  return results;
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void (async () => {
    const results = await syncBrandOffers();
    console.log(JSON.stringify(results, null, 2));
    const failed = results.filter((r) => r.error).length;
    // Exit 1 solo se TUTTI i brand falliscono: un singolo sito giu' non deve
    // far fallire il run (gli altri brand si aggiornano comunque).
    process.exit(failed === results.length && results.length > 0 ? 1 : 0);
  })();
}
