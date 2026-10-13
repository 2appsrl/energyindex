/**
 * ETL Portale Offerte — dataset Mercato Libero (offerte online dei brand,
 * livello bulk del canale online_brand; lo scraping diretto resta il livello
 * di freschezza). Contenuto Pro: escluso dalle RPC pubbliche demo.
 *
 * Flow:
 *  1. Download XML E + G del giorno (fallback fino a 5 giorni indietro:
 *     il portale pubblica con qualche giorno di ritardo/festivi)
 *  2. Parse → upsert in mercato_libero_offers, source='portale_mercato_libero'
 *  3. Soft-delete: is_active=false per i COD_OFFERTA non piu' presenti
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Cron: giornaliero (.github/workflows/etl-portale-mlibero-daily.yml).
 */
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMliberoXmlUrl,
  dominantVarIdx,
  parseMliberoXml,
  type MliberoOffer,
} from "./lib/portale-mlibero";

const SOURCE = "portale_mercato_libero" as const;
/** Indici PUN per le variabili electricity (12 = per fasce, 01 = monorario). */
const ELECTRICITY_VAR_IDX = ["12", "01"];

interface SyncResult {
  dataDate: string | null;
  fetched: number;
  brands: number;
  upserted: number;
  deactivated: number;
  errors: number;
}

function supabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchXml(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (EnergyIndex ETL)" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) return null;
  return res.text();
}

/** Prova oggi e fino a 5 giorni indietro; i due file devono avere la stessa data. */
async function downloadLatest(): Promise<{ date: string; e: string; g: string } | null> {
  for (let back = 0; back <= 5; back++) {
    const d = new Date(Date.now() - back * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    const e = await fetchXml(buildMliberoXmlUrl(iso, "E"));
    if (!e) continue;
    const g = await fetchXml(buildMliberoXmlUrl(iso, "G"));
    if (!g) continue;
    return { date: iso, e, g };
  }
  return null;
}

export function mapToDbRow(o: MliberoOffer, syncedAt: Date): Record<string, unknown> {
  const supplierLabel = o.supplierDomain
    ? o.supplierDomain.replace(/\.(it|com|eu|net|org)$/i, "")
    : `PIVA ${o.piva}`;
  return {
    external_id: o.codOfferta,
    source: SOURCE,
    source_brand: o.supplierDomain ?? o.piva,
    offer_code: o.codOfferta,
    offer_name: o.offerName,
    supplier: supplierLabel,
    supplier_slug: (o.supplierDomain ?? o.piva).replace(/[^a-z0-9]+/gi, "-"),
    supplier_logo_url: null,
    commodity: o.commodity,
    price_type: o.priceType,
    price_value: o.priceValue,
    price_unit: o.commodity === "electricity" ? "€/kWh" : "€/Smc",
    customer_segment: "domestico",
    valid_from: null,
    valid_to: o.validTo,
    fixed_cost_monthly: o.fixedCostMonthly,
    source_url: o.sourceUrl,
    notes: o.priceType === "variabile" ? `Indice ${o.idxPrezzo ?? "?"} (Portale Offerte)` : null,
    last_verified_at: syncedAt.toISOString(),
    creator_role: "superadmin",
    raw: o,
    is_active: true,
    synced_at: syncedAt.toISOString(),
  };
}

export async function syncPortaleMlibero(): Promise<SyncResult> {
  const startedAt = new Date();
  const supabase = supabaseClient();
  let errors = 0;

  const files = await downloadLatest();
  if (!files) {
    console.error("[mlibero-etl] nessun file XML disponibile negli ultimi 5 giorni");
    return { dataDate: null, fetched: 0, brands: 0, upserted: 0, deactivated: 0, errors: 1 };
  }
  console.log(`[mlibero-etl] file del ${files.date} (E ${files.e.length}B, G ${files.g.length}B)`);

  const gasIdx = dominantVarIdx(files.g);
  const offers = [
    ...parseMliberoXml(files.e, "electricity", ELECTRICITY_VAR_IDX),
    ...parseMliberoXml(files.g, "gas", gasIdx ? [gasIdx] : null),
  ];
  const brands = new Set(offers.map((o) => o.supplierDomain ?? o.piva)).size;
  console.log(`[mlibero-etl] parsed ${offers.length} offerte domestiche da ${brands} venditori (gas idx=${gasIdx})`);

  if (offers.length === 0) {
    return { dataDate: files.date, fetched: 0, brands: 0, upserted: 0, deactivated: 0, errors: 1 };
  }

  // Upsert a blocchi (payload ~3k righe: 500 per batch).
  const syncedAt = startedAt;
  const rows = offers.map((o) => mapToDbRow(o, syncedAt));
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error, count } = await supabase
      .from("mercato_libero_offers")
      .upsert(rows.slice(i, i + 500), { onConflict: "source,external_id", count: "exact" });
    if (error) {
      errors++;
      console.error(`[mlibero-etl] upsert batch ${i}: ${error.message}`);
    } else {
      upserted += count ?? 0;
    }
  }

  // Soft-delete di tutto cio' che non e' stato toccato da questo run.
  const { error: delErr, count: delCount } = await supabase
    .from("mercato_libero_offers")
    .update({ is_active: false }, { count: "exact" })
    .eq("source", SOURCE)
    .eq("is_active", true)
    .lt("synced_at", syncedAt.toISOString());
  if (delErr) {
    errors++;
    console.error(`[mlibero-etl] soft-delete: ${delErr.message}`);
  }

  const r: SyncResult = {
    dataDate: files.date,
    fetched: offers.length,
    brands,
    upserted,
    deactivated: delCount ?? 0,
    errors,
  };
  console.log(`[mlibero-etl] ${JSON.stringify(r)}`);
  return r;
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void (async () => {
    const r = await syncPortaleMlibero();
    process.exit(r.errors === 0 ? 0 : 1);
  })();
}
