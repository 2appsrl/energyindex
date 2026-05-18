import type { Metadata } from "next";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { PriceShowcaseCard } from "@/components/home/PriceShowcaseCard";
import { MarketBanner } from "@/components/home/MarketBanner";
import { DriverCard } from "@/components/home/DriverCard";
import { Droplets, Flame as FlameIcon, Leaf, Thermometer } from "lucide-react";

export const metadata: Metadata = {
  title: "Energy Index — Prezzi luce e gas in tempo reale",
  description:
    "Osservatorio gratuito su PUN (luce), PSV (gas) e offerte ARERA mercato libero. Confronta tariffe luce e gas in pochi click.",
  openGraph: {
    title: "Energy Index — Prezzi luce e gas in tempo reale",
    description:
      "Osservatorio gratuito su PUN, PSV e offerte ARERA mercato libero.",
    type: "website",
    locale: "it_IT",
    url: "/it",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Energy Index — Prezzi luce e gas in tempo reale",
    description: "Osservatorio gratuito su PUN, PSV e offerte ARERA mercato libero.",
    images: ["/opengraph-image"],
  },
};

async function getLatestPair(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  slug: string,
): Promise<{ value: number | null; prevValue: number | null; unit: string }> {
  const { data: meta } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, unit")
    .eq("asset_slug", slug)
    .maybeSingle();
  if (!meta) return { value: null, prevValue: null, unit: "€/MWh" };

  const nowIso = new Date().toISOString();
  const { data: rows } = await supabase
    .from("price_observations")
    .select("value")
    .eq("asset_id", meta.asset_id)
    .lte("observed_at", nowIso)
    .order("observed_at", { ascending: false })
    .limit(2);

  return {
    value: rows?.[0] ? Number(rows[0].value) : null,
    prevValue: rows?.[1] ? Number(rows[1].value) : null,
    unit: (meta.unit as string) ?? "€/MWh",
  };
}

async function getMarketBannerData(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<{ luceVariabileMedian: number | null; totalOffers: number }> {
  // Latest luce-variabile aggregate
  const { data: latest } = await supabase
    .from("energy_index_aggregates")
    .select("median, sample_size, computed_at")
    .eq("aggregate_slug", "mercato-libero-luce-variabile")
    .order("computed_at", { ascending: false })
    .limit(1);

  if (!latest || latest.length === 0) {
    return { luceVariabileMedian: null, totalOffers: 0 };
  }

  // Total offers ON THAT same computed_at across all 4 slugs
  const latestDate = latest[0].computed_at;
  const { data: totals } = await supabase
    .from("energy_index_aggregates")
    .select("sample_size")
    .eq("computed_at", latestDate);

  const total = (totals ?? []).reduce(
    (s, r) => s + Number(r.sample_size ?? 0),
    0,
  );
  return {
    luceVariabileMedian: Number(latest[0].median),
    totalOffers: total,
  };
}

async function getDriverLatest(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  slug: string,
): Promise<{ value: number | null; prevValue: number | null; unit: string }> {
  return getLatestPair(supabase, slug);
}

async function getTemperatureAnomaly(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<{ value: number | null; anomaly: number | null; baseline_years: number }> {
  const { data } = await supabase.rpc("get_temperature_anomaly");
  const row = Array.isArray(data) ? data[0] : null;
  return {
    value: row?.value ?? null,
    anomaly: row?.anomaly ?? null,
    baseline_years: row?.baseline_years ?? 0,
  };
}

export default async function HomeIt() {
  const supabase = await createServerClient();
  const [pun, psv, market, brent, co2, tempAnom, ttf] = await Promise.all([
    getLatestPair(supabase, "pun"),
    getLatestPair(supabase, "psv"),
    getMarketBannerData(supabase),
    getDriverLatest(supabase, "brent"),
    getDriverLatest(supabase, "co2"),
    getTemperatureAnomaly(supabase),
    getDriverLatest(supabase, "ttf"),
  ]);

  return (
    <div className="container mx-auto py-12 sm:py-16 px-4 space-y-8 sm:space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl sm:text-5xl font-bold">Energy Index</h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          Osservatorio prezzi luce e gas in tempo reale.
        </p>
      </header>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
        <PriceShowcaseCard
          href="/it/indice/pun"
          icon="zap"
          title="Energia Elettrica"
          value={pun.value}
          prevValue={pun.prevValue}
          unit={pun.unit}
          commodity="luce"
          ariaLabel="Apri analisi prezzi energia elettrica"
        />
        <PriceShowcaseCard
          href="/it/indice/psv"
          icon="flame"
          title="Gas"
          value={psv.value}
          prevValue={psv.prevValue}
          unit={psv.unit}
          commodity="gas"
          ariaLabel="Apri analisi prezzi gas"
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight border-l-4 border-primary pl-3">
          Driver di mercato
        </h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <DriverCard
            href="/it/indice/ttf"
            icon={FlameIcon}
            title="TTF Gas Europa"
            subtitle="Benchmark front-month"
            value={ttf.value}
            prevValue={ttf.prevValue}
            unit="€/MWh"
          />
          <DriverCard
            href="/it/indice/brent"
            icon={Droplets}
            title="Brent"
            subtitle="Petrolio greggio"
            value={brent.value}
            prevValue={brent.prevValue}
            unit="$/bbl"
          />
          <DriverCard
            href="/it/indice/co2"
            icon={Leaf}
            title="CO2 EUA"
            subtitle="Quota emissione EU ETS"
            value={co2.value}
            prevValue={co2.prevValue}
            unit="€/tCO2"
          />
          <DriverCard
            href="/it/indice/temperatura"
            icon={Thermometer}
            title="Temperatura Italia"
            subtitle="Anomalia stagionale"
            value={tempAnom.value}
            unit="°C"
            anomaly={tempAnom.baseline_years >= 3 ? tempAnom.anomaly : null}
            baselineLabel="vs media 5 anni"
          />
        </div>
      </section>

      {/* MARKET BANNER (consumer-end: confronto offerte mercato libero) */}
      <MarketBanner
        luceVariabileMedian={market.luceVariabileMedian}
        totalOffers={market.totalOffers}
      />

      {/* MEGA CTA verso EIDX Pro — audience B2B (fornitori/mandanti/broker)
          posizionata SOTTO il banner consumer, cosi' chi cerca offerte trova
          subito il banner mercato libero; chi e' azienda scrolla un po'
          piu' giu' e trova il CTA Pro. */}
      <Link
        href="/it/pro"
        className="group relative block overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a3d2e] via-[#0f5239] to-[#0a3d2e] p-8 sm:p-12 shadow-2xl shadow-emerald-900/20 transition-all hover:shadow-emerald-900/40 hover:-translate-y-1 ring-1 ring-emerald-400/10"
      >
        {/* Decorative glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -bottom-20 h-60 w-60 rounded-full bg-amber-400/10 blur-3xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" aria-hidden />
              Per fornitori, mandanti, broker
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Sei un&apos;azienda del settore energy?{" "}
              <span className="text-emerald-300">EIDX Pro</span> è il tuo tool.
            </h2>
            <p className="text-base md:text-lg text-emerald-50/90 max-w-xl">
              Lo stack analytics per fornitori energy, broker e PMI energivore. 4 tool per
              simulare margini, modellare scenari di mercato, generare report brandizzati e
              trovare l&apos;offerta migliore per ogni cliente.
            </p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-emerald-50/80">
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Margin Simulator (P&amp;L cliente)</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Forecast &amp; Scenari what-if</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Report PDF brandizzato</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Customer Simulator (best offer)</span>
              </li>
            </ul>
          </div>

          <div className="flex-shrink-0 flex flex-col items-stretch lg:items-end gap-3">
            <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-400 px-8 py-5 text-base md:text-lg font-bold text-emerald-950 shadow-xl shadow-emerald-500/30 transition-all group-hover:scale-[1.03] group-hover:shadow-emerald-500/50">
              <span aria-hidden className="text-xl">→</span>
              Scopri EIDX Pro
            </span>
            <p className="text-xs text-emerald-200/70 text-center lg:text-right">
              Demo gratuite · niente registrazione · lancio Q3 2026
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
