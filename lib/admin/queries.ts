import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { KeyStatus } from "@/lib/api-keys/link-check";
import type { IdentifiedCall } from "./api-consumers";
import { mergeKeyUsage, type KeyUsage } from "./integrations";
import type { LeadSource, LeadStatus } from "./leads";
import { MAIL_SYNC_SOURCE, type InboundEmail } from "@/lib/mail/types";

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

const ADMIN_MIGRATION = "20260927000001_admin_traffic_leads.sql";
const KEYS_MIGRATION = "20261031000001_api_keys_throttle.sql";
const INTEGRATIONS_MIGRATION = "20261031000002_admin_integrations.sql";

function explain(message: string, migration = ADMIN_MIGRATION): string {
  if (/does not exist|Could not find the (function|table)|schema cache/i.test(message)) {
    return `Tabelle o funzioni mancanti: applica la migrazione ${migration}.`;
  }
  return message;
}

async function rpc<T>(fn: string, args: Record<string, unknown>, migration?: string): Promise<Result<T>> {
  const supabase = createServiceClient();
  if (!supabase) return { data: null, error: NO_CLIENT };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: explain(error.message, migration) };
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

const IDENTIFIED_PAGE = 1000;
const IDENTIFIED_MAX = 10000;

/**
 * Chiamate API con un sito o una chiave riconoscibili. I client anonimi hanno
 * nel consumer l'impronta "#abc" e restano fuori: un solo programma che
 * interroga di continuo non deve spingere via i siti. PostgREST restituisce al
 * massimo 1000 righe per volta, quindi si legge a pagine.
 */
export async function identifiedApiCalls(days: number): Promise<Result<{ rows: IdentifiedCall[]; truncated: boolean }>> {
  const supabase = createServiceClient();
  if (!supabase) return { data: null, error: NO_CLIENT };
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows: IdentifiedCall[] = [];
  while (rows.length < IDENTIFIED_MAX) {
    const { data, error } = await supabase
      .from("traffic_log")
      .select("ts, path, query, origin_host, referer_host, api_key_prefix, ip_hash")
      .eq("kind", "api")
      .gte("ts", since)
      .not("consumer", "like", "%#%")
      .order("ts", { ascending: false })
      .range(rows.length, rows.length + IDENTIFIED_PAGE - 1);
    if (error) return { data: null, error: explain(error.message) };
    rows.push(...((data ?? []) as IdentifiedCall[]));
    if ((data ?? []).length < IDENTIFIED_PAGE) return { data: { rows, truncated: false }, error: null };
  }
  return { data: { rows, truncated: true }, error: null };
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

const MAIL_MIGRATION = "20261105000001_inbound_emails.sql";

export async function listInboundEmails(): Promise<Result<InboundEmail[]>> {
  const supabase = createServiceClient();
  if (!supabase) return { data: null, error: NO_CLIENT };
  const { data, error } = await supabase
    .from("inbound_emails")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(300);
  if (error) return { data: null, error: explain(error.message, MAIL_MIGRATION) };
  return { data: data as InboundEmail[], error: null };
}

export interface MailSync {
  finished_at: string | null;
  status: string;
  error_message: string | null;
}

/** Ultima sincronizzazione della casella; null se non e' mai partita. */
export async function lastMailSync(): Promise<Result<MailSync | null>> {
  const supabase = createServiceClient();
  if (!supabase) return { data: null, error: NO_CLIENT };
  const { data, error } = await supabase
    .from("etl_runs")
    .select("finished_at, status, error_message")
    .eq("source", MAIL_SYNC_SOURCE)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: explain(error.message) };
  return { data: data as MailSync | null, error: null };
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

// ============================================================ INTEGRAZIONI

export interface ApiKeyRow {
  id: string;
  prefix: string | null;
  email: string;
  nome: string;
  domain: string;
  attribution_url: string;
  plan: string;
  status: KeyStatus;
  link_ok: boolean | null;
  link_checked_at: string | null;
  link_failures: number;
  created_at: string;
  activated_at: string | null;
  revoked_at: string | null;
}

export interface ApiKeyWithUsage extends ApiKeyRow {
  /** Chiamate negli ultimi KEY_USAGE_DAYS giorni; null se il conteggio non e' disponibile. */
  calls_30d: number | null;
}

export interface DomainRow {
  origin_host: string;
  requests: number;
  uniques: number;
  first_seen: string;
  last_seen: string;
}

export const KEY_USAGE_DAYS = 30;

/**
 * Chiavi API, piu' recenti prima, con le chiamate degli ultimi 30 giorni.
 * Se manca solo la RPC del conteggio la lista si vede lo stesso (usageError).
 */
export async function listApiKeys(): Promise<Result<{ keys: ApiKeyWithUsage[]; usageError: string | null }>> {
  const supabase = createServiceClient();
  if (!supabase) return { data: null, error: NO_CLIENT };
  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, prefix, email, nome, domain, attribution_url, plan, status, link_ok, link_checked_at, link_failures, created_at, activated_at, revoked_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return { data: null, error: explain(error.message, KEYS_MIGRATION) };
  const usage = await rpc<KeyUsage[]>("admin_api_key_usage", { p_days: KEY_USAGE_DAYS }, INTEGRATIONS_MIGRATION);
  return {
    data: { keys: mergeKeyUsage(data as ApiKeyRow[], usage.data), usageError: usage.error },
    error: null,
  };
}

async function domainRows(fn: string, days: number): Promise<Result<DomainRow[]>> {
  const r = await rpc<DomainRow[]>(fn, { p_days: days }, INTEGRATIONS_MIGRATION);
  if (r.error !== null) return r;
  return { data: r.data.map((x) => ({ ...x, requests: num(x.requests), uniques: num(x.uniques) })), error: null };
}

/** Domini da cui viene caricato il widget (chiamate con ?src=widget). */
export function widgetDomains(days: number): Promise<Result<DomainRow[]>> {
  return domainRows("admin_widget_domains", days);
}

/** Siti che chiamano le API dal browser senza chiave e non dal widget: lead. */
export function keylessApiDomains(days: number): Promise<Result<DomainRow[]>> {
  return domainRows("admin_keyless_api_domains", days);
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
