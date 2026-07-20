"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sliders, Lock, Trophy } from "lucide-react";
import { DemoLockBanner } from "./DemoLockBanner";
import {
  CLUSTERS,
  getCluster,
  computePriceLadder,
  type ClusterId,
  type CompetitorBenchmark,
} from "@/lib/pro/pricing-math";

const EUR0 = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const PCT0 = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export interface DynamicPricingViewProps {
  benchmark: CompetitorBenchmark;
  costoApprovvigionamentoEurPerMwh: number;
}

export function DynamicPricingView({
  benchmark,
  costoApprovvigionamentoEurPerMwh,
}: DynamicPricingViewProps) {
  const [selectedId, setSelectedId] = useState<ClusterId>("pmi");
  const cluster = useMemo(() => getCluster(selectedId)!, [selectedId]);

  const ladder = useMemo(
    () =>
      cluster.locked
        ? null
        : computePriceLadder(cluster, benchmark, costoApprovvigionamentoEurPerMwh),
    [cluster, benchmark, costoApprovvigionamentoEurPerMwh],
  );

  return (
    <div className="space-y-4">
      <DemoLockBanner
        icon={Sliders}
        title="Demo: 1 cluster sbloccato (PMI), altri 4 lockati. No export listino, no scheduling."
        description="Tier Pro 499€/mese: tutti i 5 cluster + cluster custom, scheduling settimanale, export CSV listino, A/B test prezzi."
      />

      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-stone-500 font-semibold">
          Cluster cliente
        </h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {CLUSTERS.map((c) => (
            <ClusterCard
              key={c.id}
              cluster={c}
              selected={c.id === selectedId}
              onSelect={() => !c.locked && setSelectedId(c.id)}
            />
          ))}
        </div>
        <p className="text-xs text-stone-600">
          <strong>{cluster.label}.</strong> {cluster.description}
        </p>
      </div>

      {/* COMPETITOR BENCHMARK */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-stone-900">Competitor benchmark (live)</h2>
          <span className="text-xs text-stone-500">
            {benchmark.nOfferte} offerte mercato libero analizzate
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <BenchStat label="25° pct (aggressive)" value={`${benchmark.p25.toFixed(1)} €/MWh`} />
          <BenchStat label="Mediana" value={`${benchmark.median.toFixed(1)} €/MWh`} highlight />
          <BenchStat label="75° pct (premium)" value={`${benchmark.p75.toFixed(1)} €/MWh`} />
        </div>
      </section>

      {/* PRICE LADDER */}
      {ladder ? (
        <section className="space-y-3">
          <h2 className="font-semibold text-stone-900">Price ladder consigliato</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {ladder.ladder.map((p, i) => (
              <PricePointCard
                key={p.id}
                point={p}
                isOptimal={i === ladder.optimalIndex}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-300/40 bg-amber-50/40 p-8 text-center space-y-3">
          <Lock className="h-8 w-8 text-amber-600 mx-auto" aria-hidden />
          <h3 className="text-xl font-bold">{cluster.label}</h3>
          <p className="text-sm text-stone-600 max-w-md mx-auto">{cluster.description}</p>
          <Link
            href="/it/pro#early-access"
            className="inline-flex items-center justify-center rounded-md bg-amber-600 text-white px-4 py-2 text-sm font-bold hover:bg-amber-500 transition-colors"
          >
            Sblocca con Pro 499€/mese
          </Link>
        </section>
      )}

      {/* LOCKED FEATURES */}
      <div className="grid gap-3 sm:grid-cols-3 pt-2">
        <LockedFeature
          title="Scheduling settimanale"
          description="Re-run automatico ogni lunedi' su nuovo benchmark competitor, alert se shift > 5%."
        />
        <LockedFeature
          title="A/B test prezzi"
          description="Split prospects in 2 ladder, misura take-rate effettivo vs predetto."
        />
        <LockedFeature
          title="Cluster custom"
          description="Definisci cluster oltre i 5 preset usando attributi proprietari (CRM)."
        />
      </div>
    </div>
  );
}

// ============================================================
// CLUSTER CARD
// ============================================================

function ClusterCard({
  cluster,
  selected,
  onSelect,
}: {
  cluster: (typeof CLUSTERS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={cluster.locked}
      className={`text-left rounded-2xl border p-3 space-y-1 transition-all ${
        selected
          ? "border-emerald-500 bg-emerald-50/40 shadow-md shadow-emerald-500/10"
          : cluster.locked
            ? "border-amber-300/50 bg-amber-50/30 cursor-not-allowed opacity-75"
            : "border-stone-200 bg-white hover:border-stone-400 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${
            cluster.locked ? "text-amber-700" : selected ? "text-emerald-700" : "text-stone-500"
          }`}
        >
          {cluster.locked ? "Pro 499€" : selected ? "Attivo" : "Demo"}
        </span>
        {cluster.locked && <Lock className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
      </div>
      <h3 className="font-bold text-stone-900 text-sm leading-tight">{cluster.label}</h3>
      <p className="text-[11px] text-stone-600">
        {(cluster.typicalAnnualKwh / 1000).toFixed(0)}k kWh/anno · elasticita&apos;{" "}
        {cluster.priceElasticity.toFixed(1)}x
      </p>
    </button>
  );
}

// ============================================================
// BENCH STAT
// ============================================================

function BenchStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-emerald-50 border border-emerald-200" : "bg-stone-50"}`}>
      <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
        {label}
      </p>
      <p
        className={`text-lg font-bold tabular-nums ${highlight ? "text-emerald-700" : "text-stone-800"}`}
      >
        {value}
      </p>
    </div>
  );
}

// ============================================================
// PRICE POINT CARD
// ============================================================

function PricePointCard({
  point,
  isOptimal,
}: {
  point: ReturnType<typeof computePriceLadder>["ladder"][number];
  isOptimal: boolean;
}) {
  return (
    <article
      className={`relative rounded-2xl border p-5 space-y-3 transition-all ${
        isOptimal
          ? "border-emerald-500 bg-emerald-50/40 shadow-lg shadow-emerald-500/10"
          : "border-stone-200 bg-white"
      }`}
    >
      {isOptimal && (
        <span className="absolute -top-2 -right-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow">
          <Trophy className="h-3 w-3" aria-hidden />
          Optimal
        </span>
      )}
      <h3 className="font-bold text-stone-900">{point.label}</h3>
      <div className="space-y-1">
        <p className="text-3xl font-bold tabular-nums text-stone-900">
          {point.spreadEurPerMwh.toFixed(1)}{" "}
          <span className="text-sm font-normal text-stone-500">€/MWh spread</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200/50">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
            Take-rate
          </p>
          <p className="text-lg font-bold tabular-nums text-emerald-700">
            {PCT0.format(point.takeRate)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
            Margine / cliente
          </p>
          <p className="text-lg font-bold tabular-nums text-stone-800">
            {EUR0.format(point.marginPerAcquiredEur)}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
            Margine atteso / 100 prospect
          </p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              isOptimal ? "text-emerald-700" : "text-stone-700"
            }`}
          >
            {EUR0.format(point.expectedMarginPer100Prospects)}
          </p>
        </div>
      </div>
    </article>
  );
}

// ============================================================
// LOCKED FEATURE
// ============================================================

function LockedFeature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/40 p-4 flex items-start gap-3 opacity-75">
      <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
      <div className="space-y-0.5">
        <p className="text-sm font-bold text-stone-700">{title}</p>
        <p className="text-xs text-stone-600">{description}</p>
      </div>
    </div>
  );
}
