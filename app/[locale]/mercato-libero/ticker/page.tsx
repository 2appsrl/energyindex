import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { MarketMap, type Offer } from "./MarketMap";

export const metadata: Metadata = {
  title: "Market Map — Tutte le offerte | Energy Index",
  description:
    "Mappa interattiva di tutte le offerte PLACET pubblicate dal Portale Offerte ARERA. Confronta in tempo reale 1.500+ tariffe luce e gas.",
};

interface RawOfferRow {
  offer_code: string;
  supplier: string;
  commodity: string;
  price_type: string;
  price_value: number | string;
  valid_from: string;
  valid_to: string | null;
  raw: Record<string, unknown> | null;
}

export default async function MarketMapPage() {
  const supabase = await createServerClient();

  // "Offerte attive oggi" = valid_from <= EOD oggi AND (valid_to NULL OR >= start oggi).
  // Confronto a stringa ISO date funziona per timestamptz (Postgres normalizza).
  const today = new Date().toISOString().slice(0, 10);
  const todayEnd = `${today}T23:59:59+00:00`;
  const todayStart = `${today}T00:00:00+00:00`;

  const allRows: RawOfferRow[] = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const { data, error } = await supabase
      .from("arera_offers")
      .select(
        "offer_code, supplier, commodity, price_type, price_value, valid_from, valid_to, raw",
      )
      .lte("valid_from", todayEnd)
      .or(`valid_to.is.null,valid_to.gte.${todayStart}`)
      .order("price_value", { ascending: true })
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    allRows.push(...(data as RawOfferRow[]));
    if (data.length < 1000) break;
  }

  const filtered = allRows.filter(
    (o) =>
      o.raw !== null &&
      typeof o.raw === "object" &&
      (o.raw as Record<string, unknown>).tipo_cliente === "domestico" &&
      Number.isFinite(Number(o.price_value)),
  );

  // Mediana per categoria (commodity + price_type) per il color delta
  const groups = new Map<string, number[]>();
  for (const o of filtered) {
    const key = `${o.commodity}_${o.price_type}`;
    const arr = groups.get(key) ?? [];
    arr.push(Number(o.price_value));
    groups.set(key, arr);
  }
  const medians = new Map<string, number>();
  for (const [k, prices] of groups) {
    prices.sort((a, b) => a - b);
    medians.set(k, prices[Math.floor(prices.length / 2)]);
  }

  const offers: Offer[] = filtered.map((o) => {
    const key = `${o.commodity}_${o.price_type}`;
    return {
      codice: o.offer_code,
      vendor: o.supplier,
      commodity: o.commodity as "electricity" | "gas",
      priceType: o.price_type as "fisso" | "variabile",
      price: Number(o.price_value),
      median: medians.get(key) ?? 0,
    };
  });

  return <MarketMap offers={offers} asOf={today} />;
}
