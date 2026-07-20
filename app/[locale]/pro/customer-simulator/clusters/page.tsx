import type { Metadata } from "next";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { EidxProHeader } from "@/components/pro/EidxProHeader";
import { ClusterClientiView } from "@/components/pro/ClusterClientiView";
import type { OfferRecord, ForecastAverages } from "@/lib/pro/customer-math";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cluster Clienti — Customer Simulator EIDX Pro",
  description:
    "Trova subito l'offerta migliore per i 5 profili di consumo piu' comuni: single, coppia, famiglia 3-4, famiglia 5+, all-electric. Stampa/PDF.",
  robots: { index: false },
};

interface OfferRow {
  offer_code: string;
  supplier: string;
  supplier_logo_url: string | null;
  offer_name: string | null;
  commodity: string;
  price_type: string;
  price_value: number | string;
  fixed_cost_monthly: number | string | null;
  customer_segment: string;
  source_url: string | null;
  notes: string | null;
}

interface AggregateRow {
  aggregate_slug: string;
  median: number | string;
  unit: string;
}

export default async function ClusterClientiPage() {
  const supabase = await createServerClient();

  // 1. Offerte ML attive domestico (via RPC, RLS-safe)
  const { data: offersRaw } = await supabase.rpc("get_active_mercato_libero_offers", {
    p_customer_segment: "domestico",
  });
  const offers: OfferRecord[] = ((offersRaw ?? []) as OfferRow[]).map((r) => ({
    offer_code: r.offer_code,
    supplier: r.supplier,
    supplier_logo_url: r.supplier_logo_url,
    offer_name: r.offer_name,
    commodity: r.commodity as "electricity" | "gas",
    price_type: r.price_type as "fisso" | "variabile",
    price_value: Number(r.price_value),
    fixed_cost_monthly: r.fixed_cost_monthly === null ? null : Number(r.fixed_cost_monthly),
    customer_segment: r.customer_segment as "domestico" | "business",
    source_url: r.source_url,
    notes: r.notes,
  }));

  // 2. Forecast PUN + PSV 90g per il prezzo variabile (stesso pattern del Customer Simulator)
  const [punFc, psvFc] = await Promise.all([
    supabase.rpc("get_forecast_latest", { p_asset_slugs: ["pun"], p_horizon_days: 90 }),
    supabase.rpc("get_forecast_latest", { p_asset_slugs: ["psv"], p_horizon_days: 90 }),
  ]);
  const punValue = Array.isArray(punFc.data) && punFc.data[0]
    ? Number((punFc.data[0] as { value: number | string }).value)
    : 100;
  const psvValue = Array.isArray(psvFc.data) && psvFc.data[0]
    ? Number((psvFc.data[0] as { value: number | string }).value)
    : 35;
  const forecast: ForecastAverages = {
    punAvgEurPerKwh: punValue / 1000,
    psvAvgEurPerSmc: (psvValue / 1000) * 10.5275,
  };

  // 3. PLACET reference medians dal energy_index_aggregates
  const placetSlugs = ["mercato-libero-luce-fissa", "mercato-libero-gas-fissa"];
  const { data: aggRaw } = await supabase
    .from("energy_index_aggregates")
    .select("aggregate_slug, median, unit, computed_at")
    .in("aggregate_slug", placetSlugs)
    .order("computed_at", { ascending: false });

  // Take the latest snapshot per slug
  const placetMedians = new Map<string, number>();
  for (const r of (aggRaw ?? []) as AggregateRow[]) {
    if (!placetMedians.has(r.aggregate_slug)) {
      placetMedians.set(r.aggregate_slug, Number(r.median));
    }
  }
  const placetLuceFisso = placetMedians.get("mercato-libero-luce-fissa") ?? 0.34;
  const placetGasFisso = placetMedians.get("mercato-libero-gas-fissa") ?? 1.50;

  // List of brand suppliers in our DB, for the disclaimer
  const suppliersSet = new Set<string>();
  for (const o of offers) suppliersSet.add(o.supplier);
  const suppliers = [...suppliersSet].sort();

  return (
    <>
      <EidxProHeader section="Cluster Clienti" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1 max-w-2xl print:hidden">
          <Link href="/it/pro/customer-simulator" className="text-xs text-stone-600 hover:underline">
            ← Torna al Customer Simulator
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cluster Clienti — confronto rapido</h1>
          <p className="text-sm text-stone-600">
            Migliore offerta del mercato libero per 5 profili di consumo tipici, con riferimento PLACET regolato per confronto. Stampa o salva in PDF per condividere.
          </p>
        </header>

        <ClusterClientiView
          offers={offers}
          forecast={forecast}
          placetLuceFisso={placetLuceFisso}
          placetGasFisso={placetGasFisso}
          suppliers={suppliers}
        />
      </div>
    </>
  );
}
