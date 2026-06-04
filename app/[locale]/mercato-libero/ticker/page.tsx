import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { MarketMap, type Offer } from "./MarketMap";

type Source = "all" | "placet" | "libero";

function resolveSource(src: string | undefined): Source {
  if (src === "libero") return "libero";
  if (src === "placet") return "placet";
  return "all"; // default = combinato (PLACET + mercato libero)
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}): Promise<Metadata> {
  const { src } = await searchParams;
  const source = resolveSource(src);

  const title =
    source === "libero"
      ? "Market Map — Offerte commerciali mercato libero (non-PLACET)"
      : source === "placet"
        ? "Market Map — Tutte le offerte PLACET ARERA"
        : "Market Map — Tutte le offerte luce e gas (PLACET + mercato libero)";
  const description =
    source === "libero"
      ? "Mappa interattiva delle offerte commerciali mercato libero (non-PLACET): EnergiaPro + scraping brand."
      : source === "placet"
        ? "Mappa interattiva di tutte le 1.500+ offerte PLACET pubblicate dal Portale Offerte ARERA."
        : "Mappa interattiva combinata: PLACET ARERA + commerciali mercato libero. Cerca fornitore, confronta prezzi luce e gas.";

  const urlPath =
    source === "libero"
      ? "/it/mercato-libero/ticker?src=libero"
      : source === "placet"
        ? "/it/mercato-libero/ticker?src=placet"
        : "/it/mercato-libero/ticker";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "it_IT",
      url: urlPath,
      images: ["/it/mercato-libero/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/it/mercato-libero/opengraph-image"],
    },
  };
}

interface MarketRow {
  offer_code: string;
  supplier: string;
  commodity: string;
  price_type: string;
  price_value: number | string;
  category_median: number | string;
  // Solo per get_market_map_libero (la RPC PLACET non li ha — undefined OK)
  creator_role?: string | null;
  source?: string | null;
}

/**
 * Mappa una row RPC -> Offer tipata. Annota il source di provenienza per
 * isCertificateOffer() lato client.
 */
function mapRowToOffer(r: MarketRow, fallbackSource: string): Offer {
  return {
    codice: r.offer_code,
    vendor: r.supplier,
    commodity: r.commodity as "electricity" | "gas",
    priceType: r.price_type as "fisso" | "variabile",
    price: Number(r.price_value),
    median: Number(r.category_median),
    // Certificate logic:
    //  - PLACET = sempre certificate (open data ARERA, validate dal Portale)
    //  - energiapro + creator_role='superadmin' = certificate
    //  - energiapro + creator_role='admin'|'agency' = NON certificate
    creatorRole: (r.creator_role ?? null) as Offer["creatorRole"],
    source: r.source ?? fallbackSource,
  };
}

/**
 * Ricalcola la mediana di categoria (commodity x price_type) su un set
 * combinato di offerte. Necessario per la vista "all": le mediane delle
 * due RPC sono separate (PLACET vs libero), ma per il color delta UI
 * vogliamo una mediana unica sull'universo combinato.
 */
function recalculateMedians(offers: Offer[]): Offer[] {
  const grouped = new Map<string, number[]>();
  for (const o of offers) {
    const key = `${o.commodity}_${o.priceType}`;
    (grouped.get(key) ?? grouped.set(key, []).get(key)!).push(o.price);
  }
  const medianBy = new Map<string, number>();
  for (const [key, prices] of grouped) {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
    medianBy.set(key, median);
  }
  return offers.map((o) => ({
    ...o,
    median: medianBy.get(`${o.commodity}_${o.priceType}`) ?? o.median,
  }));
}

export default async function MarketMapPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const { src } = await searchParams;
  const source = resolveSource(src);

  const supabase = await createServerClient();

  let offers: Offer[] = [];

  if (source === "all") {
    // Fetch entrambe le RPC in parallel + merge + ricalcolo mediane
    const [placetRes, liberoRes] = await Promise.all([
      supabase.rpc("get_market_map"),
      supabase.rpc("get_market_map_libero"),
    ]);
    const placetOffers = ((placetRes.data ?? []) as MarketRow[]).map((r) =>
      mapRowToOffer(r, "arera_placet"),
    );
    const liberoOffers = ((liberoRes.data ?? []) as MarketRow[]).map((r) =>
      mapRowToOffer(r, r.source ?? "energiapro_commerciali"),
    );
    offers = recalculateMedians([...placetOffers, ...liberoOffers]);
  } else {
    const rpcName = source === "libero" ? "get_market_map_libero" : "get_market_map";
    const { data: rows } = await supabase.rpc(rpcName);
    offers = ((rows ?? []) as MarketRow[]).map((r) =>
      mapRowToOffer(r, source === "placet" ? "arera_placet" : "energiapro_commerciali"),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return <MarketMap offers={offers} asOf={today} source={source} />;
}
