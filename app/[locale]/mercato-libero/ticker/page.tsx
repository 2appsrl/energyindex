import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { MarketMap, type Offer } from "./MarketMap";

export const metadata: Metadata = {
  title: "Market Map — Tutte le offerte | Energy Index",
  description:
    "Mappa interattiva di tutte le offerte PLACET pubblicate dal Portale Offerte ARERA. Confronta in tempo reale 1.500+ tariffe luce e gas.",
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
