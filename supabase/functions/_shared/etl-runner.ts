import { dbServiceRole } from "./db.ts";

export interface EtlContext {
  log: (msg: string, extra?: Record<string, unknown>) => void;
}

export interface EtlResult {
  rows_ingested: number;
  metadata?: Record<string, unknown>;
}

export async function runEtl(
  source: string,
  fn: (ctx: EtlContext) => Promise<EtlResult>,
): Promise<Response> {
  const db = dbServiceRole();
  const startedAt = new Date().toISOString();
  const logs: Array<{ msg: string; extra?: Record<string, unknown>; ts: string }> = [];
  const ctx: EtlContext = {
    log: (msg, extra) => logs.push({ msg, extra, ts: new Date().toISOString() }),
  };

  // 1. Insert running row
  const { data: runRow, error: insertErr } = await db
    .from("etl_runs")
    .insert({ source, started_at: startedAt, status: "running" })
    .select("id")
    .single();

  if (insertErr || !runRow) {
    return new Response(
      JSON.stringify({ ok: false, error: `cannot insert etl_runs: ${insertErr?.message}` }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const runId = runRow.id;

  try {
    const result = await fn(ctx);
    await db.from("etl_runs").update({
      finished_at: new Date().toISOString(),
      status: "ok",
      rows_ingested: result.rows_ingested,
      metadata: { ...result.metadata, logs },
    }).eq("id", runId);
    return new Response(
      JSON.stringify({ ok: true, run_id: runId, ...result }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("etl_runs").update({
      finished_at: new Date().toISOString(),
      status: "error",
      error_message: message,
      metadata: { logs },
    }).eq("id", runId);
    return new Response(
      JSON.stringify({ ok: false, run_id: runId, error: message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
