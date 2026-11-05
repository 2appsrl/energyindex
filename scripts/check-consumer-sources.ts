/**
 * Controllo settimanale: i siti che hanno chiamato le API negli ultimi 7 giorni
 * mostrano la fonte? Scarica la home di ognuno e salva l'esito, che l'admin
 * mostra in "Chi usa le API". Non scrive a nessuno e non blocca nessuno.
 *
 * Il repository e' pubblico: nei log vanno solo i conteggi, mai i nomi dei siti.
 *
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/check-consumer-sources.ts
 */
import { createClient } from "@supabase/supabase-js";
import { aggregateConsumers, type IdentifiedCall } from "../lib/admin/api-consumers";
import { fetchPageHtml } from "../lib/api-keys/link-check";
import { runSourceChecks } from "../lib/api-keys/source-check";

const DAYS = 7;
const PAGE = 1000;
const MAX_SITES = 200;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("mancano SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const rows: IdentifiedCall[] = [];
  for (;;) {
    const { data, error } = await db
      .from("traffic_log")
      .select("ts, path, query, origin_host, referer_host, api_key_prefix, ip_hash")
      .eq("kind", "api")
      .gte("ts", since)
      .not("consumer", "like", "%#%")
      .order("ts", { ascending: false })
      .range(rows.length, rows.length + PAGE - 1);
    if (error) throw new Error(`lettura traffic_log: ${error.message}`);
    rows.push(...((data ?? []) as IdentifiedCall[]));
    if ((data ?? []).length < PAGE) break;
  }

  const sites = aggregateConsumers(rows)
    .filter((c) => c.kind !== "chiave")
    .slice(0, MAX_SITES)
    .map((c) => c.name);

  const summary = await runSourceChecks(sites, {
    fetchHtml: (page) => fetchPageHtml(page),
    save: async (check) => {
      const { error } = await db.from("api_consumer_sources").upsert(check, { onConflict: "site" });
      if (error) throw new Error(error.message);
    },
  });
  console.log(JSON.stringify(summary));
  if (summary.saveErrors > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
