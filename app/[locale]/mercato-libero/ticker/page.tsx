import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { MarketMap, type Offer } from "./MarketMap";

export const metadata: Metadata = {
  title: "Market Map — Tutte le offerte luce e gas in tempo reale",
  description:
    "Mappa interattiva di tutte le 1.500+ offerte PLACET pubblicate dal Portale Offerte ARERA. Cerca fornitore, confronta prezzi luce e gas.",
  openGraph: {
    title: "Market Map — Tutte le offerte luce e gas",
    description:
      "Mappa interattiva di 1.500+ offerte PLACET ARERA. Cerca fornitore, confronta prezzi.",
    type: "website",
    locale: "it_IT",
    url: "/it/mercato-libero/ticker",
    images: ["/it/mercato-libero/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Market Map — Tutte le offerte luce e gas",
    description: "Mappa interattiva di 1.500+ offerte PLACET ARERA.",
    images: ["/it/mercato-libero/opengraph-image"],
  },
};

interface MarketRow {
  offer_code: string;
  supplier: string;
  commodity: string;
  price_type: string;
  price_value: number | string;
  category_median: number | string;
}

export default async function MarketMapPage() {
  const supabase = await createServerClient();

  // RPC: ritorna offerte attive oggi (domestico) + mediana per categoria gia'
  // pre-calcolata. La RPC esegue il filtro `valid_from <= NOW() AND (valid_to
  // IS NULL OR valid_to >= NOW())` server-side, evitando i problemi di
  // serializzazione timestamptz nelle .or() di supabase-js.
  const { data: rows } = await supabase.rpc("get_market_map");

  const offers: Offer[] = ((rows ?? []) as MarketRow[]).map((r) => ({
    codice: r.offer_code,
    vendor: r.supplier,
    commodity: r.commodity as "electricity" | "gas",
    priceType: r.price_type as "fisso" | "variabile",
    price: Number(r.price_value),
    median: Number(r.category_median),
  }));

  const today = new Date().toISOString().slice(0, 10);
  return <MarketMap offers={offers} asOf={today} />;
}
