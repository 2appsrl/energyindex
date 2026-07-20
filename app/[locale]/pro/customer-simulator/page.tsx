import type { Metadata } from "next";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { EidxProHeader } from "@/components/pro/EidxProHeader";
import { CustomerSimulator } from "@/components/pro/CustomerSimulator";
import type { OfferRecord, ForecastAverages } from "@/lib/pro/customer-math";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Simulator — EIDX Pro",
  description:
    "Trova in tempo reale l'offerta migliore per il tuo cliente in base al consumo. Confronta tutte le offerte mercato libero (PUN+spread o prezzo fisso) considerando il costo commercializzazione.",
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

export default async function CustomerSimulatorPage() {
  const supabase = await createServerClient();

  // 1. Carica TUTTE le offerte attive domestico via RPC SECURITY DEFINER.
  // NB: la tabella mercato_libero_offers ha RLS enabled senza policy public,
  // quindi una query diretta da client anon torna 0 rows. La RPC bypassa RLS
  // ed espone solo lo slice "active + segmento richiesto" (gia' filtrato
  // server-side).
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

  // 2. Carica forecast medi PUN (asset_id=1) e PSV (asset_id=8) per il prezzo
  //    effettivo delle offerte variabili. Usiamo horizon 90g come proxy del
  //    "prezzo medio prossimi 3 mesi", convertito da EUR/MWh a EUR/kWh e
  //    da EUR/MWh a EUR/Smc (factor PCS gas naturale 10.5275 kWh/Smc).
  const [punFc, psvFc] = await Promise.all([
    supabase.rpc("get_forecast_latest", { p_asset_slugs: ["pun"], p_horizon_days: 90 }),
    supabase.rpc("get_forecast_latest", { p_asset_slugs: ["psv"], p_horizon_days: 90 }),
  ]);
  const punValue = Array.isArray(punFc.data) && punFc.data[0]
    ? Number((punFc.data[0] as { value: number | string }).value)
    : 100;  // fallback
  const psvValue = Array.isArray(psvFc.data) && psvFc.data[0]
    ? Number((psvFc.data[0] as { value: number | string }).value)
    : 35;
  const forecast: ForecastAverages = {
    punAvgEurPerKwh: punValue / 1000,                 // €/MWh -> €/kWh
    psvAvgEurPerSmc: (psvValue / 1000) * 10.5275,     // €/MWh -> €/kWh -> €/Smc (PCS)
  };

  return (
    <>
      <EidxProHeader section="Customer Simulator" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1 max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Trova l&apos;offerta migliore per il tuo cliente</h1>
          <p className="text-sm text-stone-600">
            Sposta i consumi: il sistema ricalcola in tempo reale quale offerta del mercato libero costerebbe meno al cliente, considerando prezzo unitario + costo commercializzazione fisso.
          </p>
        </header>

        <CustomerSimulator offers={offers} forecast={forecast} />

        <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500 flex justify-between flex-wrap gap-2">
          <span>
            {offers.length} offerte mercato libero attive · forecast PUN/PSV 90g · per offerte variabili usa proxy{" "}
            <Link href="/it/forecast/metodologia" className="underline">Ridge v1.0</Link>
          </span>
          <span className="text-stone-400">EIDX demo pubblica · funzioni Pro a pagamento</span>
        </footer>
      </div>
    </>
  );
}
