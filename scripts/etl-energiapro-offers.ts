/**
 * ETL EnergiaPro: sincronizza le offerte commerciali dal portale energiapro.biz
 * nella tabella mercato_libero_offers.
 *
 * Flow:
 *  1. Fetch ALL offers from API (paginated, ~45 ad oggi)
 *  2. Upsert into mercato_libero_offers (conflict su source+external_id):
 *     - source = 'energiapro_commerciali'
 *     - external_id = offer.id (es. "ep-offer-810001")
 *     - is_active = true, synced_at = NOW()
 *  3. Soft-delete: UPDATE is_active=false per le righe energiapro con
 *     external_id NOT IN (batch corrente)
 *  4. Log new/updated/removed
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENERGIAPRO_API_KEY
 * Cron: ogni 6 ore (vedi workflow).
 */
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchAllOffers, normalizeLogo, type EnergiaProOffer } from "./lib/energiapro-client";

const SOURCE = "energiapro_commerciali" as const;

interface SyncResult {
  fetched: number;
  upserted: number;
  deactivated: number;
  errors: number;
  startedAt: Date;
  finishedAt: Date;
}

function supabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Converte un row API EnergiaPro nel formato della tabella mercato_libero_offers.
 * last_verified_at e' nel formato "YYYY-MM-DD HH:MM:SS" (no T, no Z) — parsiamo
 * assumendo UTC.
 */
export function mapApiToDbRow(o: EnergiaProOffer, syncedAt: Date): Record<string, unknown> {
  // Parse "2026-05-14 06:17:59" come UTC iso
  let lastVerifiedIso: string | null = null;
  if (o.last_verified_at) {
    const iso = o.last_verified_at.includes("T")
      ? o.last_verified_at
      : `${o.last_verified_at.replace(" ", "T")}Z`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) lastVerifiedIso = d.toISOString();
  }

  return {
    external_id: o.id,
    source: SOURCE,
    source_brand: null,
    offer_code: o.offer_code,
    offer_name: o.offer_name,
    supplier: o.supplier,
    supplier_slug: o.supplier_slug,
    supplier_logo_url: normalizeLogo(o.supplier_logo_url),
    commodity: o.commodity,
    price_type: o.price_type,
    price_value: o.price_value,
    price_unit: o.price_unit,
    customer_segment: o.customer_segment,
    valid_from: o.valid_from,
    valid_to: o.valid_to,
    source_url: o.source_url,
    notes: o.notes,
    last_verified_at: lastVerifiedIso,
    raw: o,                              // intera response come fallback
    is_active: true,
    synced_at: syncedAt.toISOString(),
  };
}

export async function syncEnergiaProOffers(): Promise<SyncResult> {
  const startedAt = new Date();
  const supabase = supabaseClient();
  let errors = 0;

  // 1. Fetch tutto da API
  const offers = await fetchAllOffers();
  console.log(`[energiapro-etl] fetched ${offers.length} offerte dalla API`);

  if (offers.length === 0) {
    // Niente da fare ma probabilmente API down — non disattiviamo nulla
    return { fetched: 0, upserted: 0, deactivated: 0, errors: 0, startedAt, finishedAt: new Date() };
  }

  // 2. Upsert batch
  const records = offers.map((o) => mapApiToDbRow(o, startedAt));
  const { error: upErr, count } = await supabase
    .from("mercato_libero_offers")
    .upsert(records, { onConflict: "source,external_id", count: "exact" });
  if (upErr) {
    errors++;
    console.error(`[energiapro-etl] upsert error: ${upErr.message}`);
  }

  // 3. Soft-delete: offerte energiapro non piu' nella response
  const currentIds = offers.map((o) => o.id);
  const { error: delErr, count: delCount } = await supabase
    .from("mercato_libero_offers")
    .update({ is_active: false }, { count: "exact" })
    .eq("source", SOURCE)
    .eq("is_active", true)
    .not("external_id", "in", `(${currentIds.map((id) => `"${id}"`).join(",")})`);
  if (delErr) {
    errors++;
    console.error(`[energiapro-etl] soft-delete error: ${delErr.message}`);
  }

  const finishedAt = new Date();
  console.log(`[energiapro-etl] fetched=${offers.length} upserted=${count ?? "?"} deactivated=${delCount ?? 0} errors=${errors} in ${finishedAt.getTime() - startedAt.getTime()}ms`);

  return {
    fetched: offers.length,
    upserted: count ?? 0,
    deactivated: delCount ?? 0,
    errors,
    startedAt,
    finishedAt,
  };
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void (async () => {
    const r = await syncEnergiaProOffers();
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.errors === 0 ? 0 : 1);
  })();
}
