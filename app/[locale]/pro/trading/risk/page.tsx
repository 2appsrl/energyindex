import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { EidxProHeader } from "@/components/pro/EidxProHeader";
import { RiskHedgingView } from "@/components/pro/RiskHedgingView";
import { computeAtr } from "@/lib/pro/trading-math";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Risk & Hedging — EIDX Pro Trading",
  description:
    "Mark-to-market portafoglio, VaR 1g/10g, hedge ratio, stress scenari per il trader desk italiano. Demo pubblica.",
  robots: { index: false },
};

export default async function RiskHedgingPage() {
  const supabase = await createServerClient();

  // 1. Forecast attuali per i 4 horizon × 3 asset (l'utente sceglie delivery
  // month, noi mappiamo al horizon piu' vicino).
  const horizons = [7, 30, 90, 180] as const;
  const forecasts: Record<number, { pun: number; psv: number; ttf: number }> = {};
  for (const h of horizons) {
    const { data } = await supabase.rpc("get_forecast_latest", {
      p_asset_slugs: ["pun", "psv", "ttf"],
      p_horizon_days: h,
    });
    const rows = (data ?? []) as Array<{ asset_slug: string; value: number | string }>;
    forecasts[h] = {
      pun: Number(rows.find((r) => r.asset_slug === "pun")?.value ?? 100),
      psv: Number(rows.find((r) => r.asset_slug === "psv")?.value ?? 30),
      ttf: Number(rows.find((r) => r.asset_slug === "ttf")?.value ?? 30),
    };
  }

  // 2. Spot + ATR 14g per il calcolo VaR
  const { data: latestData } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, asset_slug, value")
    .in("asset_slug", ["pun", "psv", "ttf"]);
  const spot: Record<string, number> = {};
  const idBySlug: Record<string, number> = {};
  for (const r of (latestData ?? []) as Array<{
    asset_id: number;
    asset_slug: string;
    value: number | string | null;
  }>) {
    spot[r.asset_slug] = r.value === null ? 0 : Number(r.value);
    idBySlug[r.asset_slug] = Number(r.asset_id);
  }

  // 3. Storico 90g per ATR via get_price_series
  async function loadSeries(slug: string): Promise<number[]> {
    const id = idBySlug[slug];
    if (!id) return [];
    const { data } = await supabase.rpc("get_price_series", {
      p_asset_id: id,
      p_interval: "90 days",
      p_bucket: "day",
    });
    return ((data ?? []) as Array<{ value: number | string }>).map((r) => Number(r.value));
  }

  const [punS, psvS, ttfS] = await Promise.all([
    loadSeries("pun"),
    loadSeries("psv"),
    loadSeries("ttf"),
  ]);
  const atrPun = computeAtr(punS, 14);
  const atrPsv = computeAtr(psvS, 14);
  const atrTtf = computeAtr(ttfS, 14);

  function lastNonNull(arr: (number | null)[]): number | null {
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = arr[i];
      if (v !== null && Number.isFinite(v)) return v;
    }
    return null;
  }

  const punSpot = spot.pun ?? 0;
  const psvSpot = spot.psv ?? 0;
  const ttfSpot = spot.ttf ?? 0;

  const atrPct = {
    pun: punSpot > 0 ? (lastNonNull(atrPun) ?? 0) / punSpot : 0.04,
    psv: psvSpot > 0 ? (lastNonNull(atrPsv) ?? 0) / psvSpot : 0.04,
    ttf: ttfSpot > 0 ? (lastNonNull(atrTtf) ?? 0) / ttfSpot : 0.04,
  };

  return (
    <>
      <EidxProHeader section="Risk & Hedging" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1 max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Risk &amp; Hedging — portafoglio
          </h1>
          <p className="text-sm text-stone-600">
            Aggiungi le tue posizioni open, vedi marca-to-market in tempo reale, VaR 1g/10g e
            stress test scenari di mercato.
          </p>
        </header>

        <RiskHedgingView
          forecastsByHorizon={forecasts}
          atrPct={atrPct}
          spot={{ pun: punSpot, psv: psvSpot, ttf: ttfSpot }}
        />

        <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500">
          VaR parametrico (distribuzione normale) — semplificazione per demo. Production:
          historical sim + Monte Carlo. Posizioni salvate solo nel tuo browser (localStorage),
          niente backend.
        </footer>
      </div>
    </>
  );
}
