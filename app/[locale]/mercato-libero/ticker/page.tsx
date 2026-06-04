import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { MarketMap, type Offer } from "./MarketMap";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}): Promise<Metadata> {
  const { src } = await searchParams;
  const source = src === "libero" ? "libero" : "placet";

  const title = source === "libero"
    ? "Market Map — Offerte commerciali mercato libero (non-PLACET)"
    : "Market Map — Tutte le offerte PLACET ARERA";
  const description = source === "libero"
    ? "Mappa interattiva delle offerte commerciali mercato libero (non-PLACET): EnergiaPro + scraping brand."
    : "Mappa interattiva di tutte le 1.500+ offerte PLACET pubblicate dal Portale Offerte ARERA. Cerca fornitore, confronta prezzi luce e gas.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "it_IT",
      url: source === "libero" ? "/it/mercato-libero/ticker?src=libero" : "/it/mercato-libero/ticker",
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

export default async function MarketMapPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const { src } = await searchParams;
  const source: "placet" | "libero" = src === "libero" ? "libero" : "placet";

  const supabase = await createServerClient();
  const rpcName = source === "libero" ? "get_market_map_libero" : "get_market_map";
  const { data: rows } = await supabase.rpc(rpcName);

  const offers: Offer[] = ((rows ?? []) as MarketRow[]).map((r) => ({
    codice: r.offer_code,
    vendor: r.supplier,
    commodity: r.commodity as "electricity" | "gas",
    priceType: r.price_type as "fisso" | "variabile",
    price: Number(r.price_value),
    median: Number(r.category_median),
    // Certificate logic:
    //  - PLACET = sempre certificate (open data ARERA, validate dal Portale Offerte)
    //  - energiapro + creator_role='superadmin' = certificate
    //  - energiapro + creator_role='admin'|'agency' = NON certificate
    creatorRole: (r.creator_role ?? null) as Offer["creatorRole"],
    source: r.source ?? (source === "placet" ? "arera_placet" : null),
  }));

  const today = new Date().toISOString().slice(0, 10);
  return <MarketMap offers={offers} asOf={today} source={source} />;
}
