import type { MetadataRoute } from "next";
import { createServerClient } from "@/lib/supabase/server";

// Rigenera la sitemap ogni 15 min: senza revalidate Next.js la congela al
// build e i lastmod restano fermi alla data dell'ultimo deploy. Google
// impara a ignorare lastmod inaccurati -> niente ricrawl frequente sulle
// query "oggi", dove la freshness e' il fattore decisivo.
export const revalidate = 900;

const BASE = "https://energyindex.it";
const ZONES = ["nord", "cnor", "csud", "sud", "sici", "sard"] as const;

/**
 * lastmod reale per asset: `recorded_at` dalla mv e' il momento in cui
 * l'ETL ha scritto l'ultima osservazione, cioe' quando il contenuto della
 * pagina e' cambiato davvero. Fallback: ora corrente se il DB non risponde.
 */
async function getLastmodBySlug(): Promise<Record<string, Date>> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("mv_latest_price_per_asset")
      .select("asset_slug, recorded_at");
    const map: Record<string, Date> = {};
    for (const row of data ?? []) {
      if (row.asset_slug && row.recorded_at) {
        map[String(row.asset_slug)] = new Date(String(row.recorded_at));
      }
    }
    return map;
  } catch {
    return {};
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const lastmod = await getLastmodBySlug();
  const forSlug = (slug: string) => lastmod[slug] ?? now;
  // Home: cambia quando cambia l'asset aggiornato piu' di recente.
  const homeLastmod = Object.values(lastmod).reduce(
    (max, d) => (d > max ? d : max),
    forSlug("pun"),
  );

  return [
    { url: `${BASE}/it`, lastModified: homeLastmod, priority: 1.0, changeFrequency: "hourly" },
    { url: `${BASE}/it/indice/pun`, lastModified: forSlug("pun"), priority: 0.9, changeFrequency: "hourly" },
    ...ZONES.map((z) => ({
      url: `${BASE}/it/indice/pun?zone=${z}`,
      lastModified: lastmod[`pun-zona-${z}`] ?? forSlug("pun"),
      priority: 0.7 as const,
      changeFrequency: "hourly" as const,
    })),
    { url: `${BASE}/it/indice/psv`, lastModified: forSlug("psv"), priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/it/indice/ttf`, lastModified: forSlug("ttf"), priority: 0.8, changeFrequency: "daily" },
    { url: `${BASE}/it/indice/brent`, lastModified: forSlug("brent"), priority: 0.7, changeFrequency: "daily" },
    { url: `${BASE}/it/indice/co2`, lastModified: forSlug("co2"), priority: 0.7, changeFrequency: "daily" },
    { url: `${BASE}/it/indice/temperatura`, lastModified: forSlug("temperatura-it"), priority: 0.6, changeFrequency: "daily" },
    { url: `${BASE}/it/mercato-libero`, lastModified: now, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/it/mercato-libero/ticker`, lastModified: now, priority: 0.7, changeFrequency: "daily" },
    { url: `${BASE}/it/ctemachine`, lastModified: now, priority: 0.5, changeFrequency: "weekly" },
    { url: `${BASE}/it/forecast`, lastModified: forSlug("pun"), priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/it/forecast/track-record`, lastModified: forSlug("pun"), priority: 0.6, changeFrequency: "daily" },
    { url: `${BASE}/it/forecast/metodologia`, lastModified: now, priority: 0.5, changeFrequency: "monthly" },
    { url: `${BASE}/it/pro`, lastModified: now, priority: 0.8, changeFrequency: "weekly" },
  ];
}
