/**
 * Chi sta chiamando le API: raggruppa le righe di traffic_log per sito o
 * chiave. Puro, cosi' si testa senza DB.
 */

export interface IdentifiedCall {
  ts: string;
  path: string;
  query: string | null;
  origin_host: string | null;
  referer_host: string | null;
  api_key_prefix: string | null;
  ip_hash: string | null;
}

export type ConsumerKind = "sito" | "widget" | "chiave";

export interface ApiConsumer {
  name: string;
  kind: ConsumerKind;
  requests: number;
  /** IP distinti: l'impronta cambia ogni giorno, quindi chi torna conta di nuovo. */
  visitors: number;
  endpoints: { path: string; requests: number }[];
  firstSeen: string;
  lastSeen: string;
}

const OWN_HOST = /^((www\.)?energyindex\.(it|pro)|(.+--)?energyindex\.netlify\.app)$/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/;
// progetto-a1b2c3d4e-team-dot.vercel.app e progetto-git-ramo-team.vercel.app
const VERCEL_PREVIEW = /^(.+?)-(?:[a-z0-9]{9}|git-[a-z0-9-]+)-[a-z0-9-]+\.vercel\.app$/;

/** Sito a cui attribuire la chiamata, o null se e' nostro o una prova in locale. */
export function consumerSite(rawHost: string): string | null {
  const host = rawHost.toLowerCase().split(":")[0];
  if (OWN_HOST.test(host) || LOCAL_HOST.test(host)) return null;
  const preview = host.match(VERCEL_PREVIEW);
  if (preview) return `${preview[1]}.vercel.app`;
  return host.replace(/^www\./, "");
}

export function aggregateConsumers(rows: IdentifiedCall[]): ApiConsumer[] {
  const byName = new Map<
    string,
    { kind: ConsumerKind; requests: number; ips: Set<string>; paths: Map<string, number>; first: string; last: string }
  >();

  for (const r of rows) {
    const host = r.origin_host ?? r.referer_host;
    const name = r.api_key_prefix ?? (host ? consumerSite(host) : null);
    if (!name) continue;

    const c = byName.get(name) ?? { kind: "sito", requests: 0, ips: new Set(), paths: new Map(), first: r.ts, last: r.ts };
    c.requests += 1;
    if (r.ip_hash) c.ips.add(r.ip_hash);
    const path = r.path.replace(/^\/api\/v1/, "") || "/";
    c.paths.set(path, (c.paths.get(path) ?? 0) + 1);
    if (r.ts < c.first) c.first = r.ts;
    if (r.ts > c.last) c.last = r.ts;
    if (r.api_key_prefix) c.kind = "chiave";
    else if (c.kind === "sito" && /(^|&)src=widget(&|$)/.test(r.query ?? "")) c.kind = "widget";
    byName.set(name, c);
  }

  return [...byName.entries()]
    .map(([name, c]) => ({
      name,
      kind: c.kind,
      requests: c.requests,
      visitors: c.ips.size,
      endpoints: [...c.paths.entries()]
        .map(([path, requests]) => ({ path, requests }))
        .sort((a, b) => b.requests - a.requests),
      firstSeen: c.first,
      lastSeen: c.last,
    }))
    .sort((a, b) => b.requests - a.requests);
}
