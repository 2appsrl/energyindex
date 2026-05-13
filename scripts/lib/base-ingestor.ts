/**
 * Pattern base per script ETL daily.
 *
 * Subclassi implementano fetch() e parse(); BaseIngestor gestisce
 * upsert su price_observations e logging del run.
 *
 * Uso da CLI:
 *   const result = await new MyIngestor().run(startDate?, endDate?);
 *   process.exit(result.status === 'success' ? 0 : 1);
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Observation {
  observed_at: Date;
  value: number;
}

export interface RunResult {
  status: "success" | "error";
  rows: number;
  error?: string;
  startedAt: Date;
  finishedAt: Date;
}

/**
 * Granularita' valide su price_observations.granularity (CHECK constraint).
 */
export type Granularity = "hourly" | "daily" | "quarter_hour";

export abstract class BaseIngestor {
  abstract name: string;
  abstract assetSlug: string;
  /**
   * Granularita' del dato sorgente. Va salvata in price_observations.granularity
   * (colonna NOT NULL). Esempi: PUN orario = 'hourly', PSV/Brent/CO2/Temperatura
   * giornaliero = 'daily'.
   */
  abstract granularity: Granularity;

  abstract fetch(start: Date, end: Date): Promise<unknown>;
  abstract parse(raw: unknown): Observation[];

  async run(start?: Date, end?: Date): Promise<RunResult> {
    const startedAt = new Date();
    const fromDate = start ?? this.yesterday();
    const toDate = end ?? new Date();
    try {
      console.log(`[${this.name}] fetch ${fromDate.toISOString().slice(0, 10)} → ${toDate.toISOString().slice(0, 10)}`);
      const raw = await this.fetch(fromDate, toDate);
      const parsed = this.parse(raw);
      console.log(`[${this.name}] parsed ${parsed.length} rows`);
      const rows = parsed.length > 0 ? await this.upsert(parsed) : 0;
      const finishedAt = new Date();
      console.log(`[${this.name}] upserted ${rows} rows in ${finishedAt.getTime() - startedAt.getTime()}ms`);
      return { status: "success", rows, startedAt, finishedAt };
    } catch (err) {
      const finishedAt = new Date();
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${this.name}] ERROR:`, message);
      return { status: "error", rows: 0, error: message, startedAt, finishedAt };
    }
  }

  protected async upsert(rows: Observation[]): Promise<number> {
    const supabase = this.supabase();
    const { data: asset, error: assetErr } = await supabase
      .from("assets")
      .select("id")
      .eq("slug", this.assetSlug)
      .maybeSingle();
    if (assetErr) {
      throw new Error(
        `lookup assets fallita per slug '${this.assetSlug}': ${assetErr.message} (code=${assetErr.code ?? "?"}, details=${assetErr.details ?? "?"})`,
      );
    }
    if (!asset) {
      throw new Error(
        `asset slug '${this.assetSlug}' non trovato in tabella assets (query ok, 0 risultati)`,
      );
    }
    const records = rows.map((r) => ({
      asset_id: asset.id,
      observed_at: r.observed_at.toISOString(),
      value: r.value,
      granularity: this.granularity,
    }));
    const { error: upErr, count } = await supabase
      .from("price_observations")
      .upsert(records, { onConflict: "asset_id,observed_at", count: "exact" });
    if (upErr) {
      throw new Error(
        `upsert price_observations fallita: ${upErr.message} (code=${upErr.code ?? "?"}, details=${upErr.details ?? "?"})`,
      );
    }
    return count ?? records.length;
  }

  protected supabase(): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      const missing: string[] = [];
      if (!url) missing.push("SUPABASE_URL");
      if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
      throw new Error(`Env vars mancanti: ${missing.join(", ")}`);
    }
    // Log diagnostico: prima parte dell'URL e lunghezza della key (mai esporre
    // il valore intero della service role).
    const urlPrefix = url.slice(0, 40);
    const keyLen = key.length;
    const keyHead = key.slice(0, 6);
    console.log(`[${this.name}] supabase url=${urlPrefix}... key=${keyHead}...(len=${keyLen})`);
    return createClient(url, key, { auth: { persistSession: false } });
  }

  protected yesterday(): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }
}
