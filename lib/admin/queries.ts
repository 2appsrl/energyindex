import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { LeadSource, LeadStatus } from "./leads";

/**
 * Letture per la dashboard /it/admin. Tutte passano dalla service role
 * (le tabelle non hanno policy per anon/authenticated) e vanno chiamate
 * solo dopo requireAdmin().
 *
 * Ogni funzione ritorna { data, error } invece di lanciare: se una tabella
 * manca (migrazione non applicata) la scheda mostra l'avviso e le altre
 * continuano a funzionare.
 */

export type Result<T> = { data: T; error: null } | { data: null; error: string };

export interface DailyPoint {
  day: string;
  requests: number;
  uniques: number;
}

export interface TopRow {
  label: string;
  requests: number;
  uniques: number;
  first_seen: string;
  last_seen: string;
}

export interface NewConsumer {
  consumer: string;
  agent: string | null;
  first_seen: string;
  requests: number;
}

export interface Lead {
  id: number;
  created_at: string;
  source: LeadSource;
  nome: string | null;
  email: string;
  azienda: string | null;
  piano: string | null;
  oggetto: string | null;
  messaggio: string | null;
  status: LeadStatus;
  notes: string | null;
}

export interface AssetFreshness {
  asset_slug: string;
  display_name_it: string | null;
  observed_at: string;
  recorded_at: string | null;
}

export interface EtlStatus {
  source: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "error";
  rows_ingested: number | null;
  error_message: string | null;
  errors_7d: number;
  runs_7d: number;
}

export interface CronStatus {
  jobname: string;
  schedule: string;
  active: boolean;
  last_start: string | null;
  last_status: string | null;
  last_message: string | null;
}

export type TrafficKind = "api" | "bot";
export type Dimension = "path" | "origin_host" | "referer_host" | "agent" | "agent_kind" | "country" | "api_key_prefix" | "consumer";

const NO_CLIENT = "SUPABASE_SERVICE_ROLE_KEY non configurata sul server.";

function explain(message: string): string {
  if (/does not exist|Could not find the (function|table)|schema cache/i.test(message)) {
    return "Tabelle o funzioni mancanti: applica la migrazione 20260927000001_admin_traffic_leads.sql.";
  }
  return message;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  const supabase = createServiceClient();
  if (!supabase) return { data: null, error: NO_CLIENT };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: explain(error.message) };
  return { data: data as T, error: null };
}

const num = (v: unknown) => Number(v ?? 0);

export async function trafficDaily(kind: TrafficKind, days: number, agentKind?: string): Promise<Result<DailyPoint[]>> {
  const r = await rpc<DailyPoint[]>("admin_traffic_daily", { p_kind: kind, p_days: days, p_agent_kind: agentKind ?? null });
  if (r.error !== null) return r;
  return { data: r.data.map((p) => ({ day: String(p.day), requests: num(p.requests), uniques: num(p.uniques) })), error: null };
}

export async function trafficTop(
  kind: TrafficKind,
  dimension: Dimension,
  days: number,
  limit = 10,
  agentKind?: string,
): Promise<Result<TopRow[]>> {
  const r = await rpc<TopRow[]>("admin_traffic_top", {
    p_kind: kind,
    p_dimension: dimension,
    p_days: days,
    p_limit: limit,
    p_agent_kind: agentKind ?? null,
  });
  if (r.error !== null) return r;
  return { data: r.data.map((x) => ({ ...x, requests: num(x.requests), uniques: num(x.uniques) })), error: null };
}

export async function newApiConsumers(days = 7): Promise<Result<NewConsumer[]>> {
  const r = await rpc<NewConsumer[]>("admin_api_new_consumers", { p_days: days, p_limit: 20 });
  if (r.error !== null) return r;
  return { data: r.data.map((x) => ({ ...x, requests: num(x.requests) })), error: null };
}

export async function listLeads(status?: LeadStatus): Promise<Result<Lead[]>> {
  const supabase = createServiceClient();
  if (!supabase) return { data: null, error: NO_CLIENT };
  let q = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return { data: null, error: explain(error.message) };
  return { data: data as Lead[], error: null };
}

export async function assetFreshness(): Promise<Result<AssetFreshness[]>> {
  const supabase = createServiceClient();
  if (!supabase) return { data: null, error: NO_CLIENT };
  const { data, error } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_slug, display_name_it, observed_at, recorded_at")
    .order("asset_slug");
  if (error) return { data: null, error: explain(error.message) };
  return { data: data as AssetFreshness[], error: null };
}

export async function etlStatus(): Promise<Result<EtlStatus[]>> {
  const r = await rpc<EtlStatus[]>("admin_etl_status", {});
  if (r.error !== null) return r;
  return { data: r.data.map((x) => ({ ...x, errors_7d: num(x.errors_7d), runs_7d: num(x.runs_7d) })), error: null };
}

export async function cronStatus(): Promise<Result<CronStatus[]>> {
  return rpc<CronStatus[]>("admin_cron_status", {});
}

/** Riempie i giorni senza dati con zero, dal piu' vecchio a oggi (Europe/Rome). */
export function fillDays(points: DailyPoint[], days: number): DailyPoint[] {
  const byDay = new Map(points.map((p) => [p.day, p]));
  const out: DailyPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
    out.push(byDay.get(d) ?? { day: d, requests: 0, uniques: 0 });
  }
  return out;
}

/** Somma delle richieste negli ultimi n giorni della serie (gia' riempita). */
export function sumLast(points: DailyPoint[], n: number, offset = 0): number {
  return points.slice(Math.max(0, points.length - n - offset), points.length - offset).reduce((s, p) => s + p.requests, 0);
}
