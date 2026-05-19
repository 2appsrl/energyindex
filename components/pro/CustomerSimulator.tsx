"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Users, Lock } from "lucide-react";
import { rankOffers, type OfferRecord, type ForecastAverages, type OfferRanking } from "@/lib/pro/customer-math";
import { DemoLockBanner } from "./DemoLockBanner";

const EUR = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("it-IT");

type CustomerType = "casa";

export function CustomerSimulator({
  offers,
  forecast,
}: {
  offers: OfferRecord[];
  forecast: ForecastAverages;
}) {
  const [customerType, setCustomerType] = useState<CustomerType>("casa");
  const [kwhAnno, setKwhAnno] = useState(0);    // utente deve muovere lo slider
  const [smcAnno, setSmcAnno] = useState(0);    // utente deve muovere lo slider

  const rankedLuce = useMemo(
    () => rankOffers(offers, forecast, kwhAnno, "electricity"),
    [offers, forecast, kwhAnno],
  );
  const rankedGas = useMemo(
    () => rankOffers(offers, forecast, smcAnno, "gas"),
    [offers, forecast, smcAnno],
  );

  return (
    <div className="space-y-4">
      <DemoLockBanner
        icon={Users}
        title="Demo: vedi solo l'offerta migliore. Top alternative lockate."
        description="Tier Pro 499€/mese: ranking completo, esportazione CSV, salva profilo cliente, alert su variazioni offerta."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* INPUT PANEL */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5 h-fit">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
            Profilo cliente
          </h2>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as CustomerType)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="casa">Casa (domestico)</option>
            {/* Business in arrivo */}
          </select>
          <p className="text-xs text-stone-500 mt-1">Business in arrivo</p>
        </div>

        <ConsumoSlider
          label="Consumo luce"
          value={kwhAnno}
          min={0}
          max={10000}
          step={100}
          unit="kWh/anno"
          mensileLabel={Math.round(kwhAnno / 12)}
          onChange={setKwhAnno}
        />

        <ConsumoSlider
          label="Consumo gas"
          value={smcAnno}
          min={0}
          max={2500}
          step={50}
          unit="Smc/anno"
          mensileLabel={Math.round(smcAnno / 12)}
          onChange={setSmcAnno}
        />

        <div className="text-xs text-stone-500 pt-3 border-t border-stone-200">
          Sposta gli slider per vedere l&apos;offerta migliore.
          <br />
          <span className="text-stone-400">Famiglia 4 persone tipica: ~2.700 kWh + ~1.400 Smc/anno.</span>
        </div>
      </div>

      {/* OUTPUT */}
      <div className="grid gap-6 md:grid-cols-2">
        <BestOfferCard
          title="Migliore offerta luce"
          ranked={rankedLuce}
          volume={kwhAnno}
          volumeUnit="kWh"
        />
        <BestOfferCard
          title="Migliore offerta gas"
          ranked={rankedGas}
          volume={smcAnno}
          volumeUnit="Smc"
        />
        <TotalBolletta
          rankedLuce={rankedLuce}
          rankedGas={rankedGas}
          kwhAnno={kwhAnno}
          smcAnno={smcAnno}
        />
        <div className="md:col-span-2 mt-2 print:hidden">
          <Link
            href="/it/pro/customer-simulator/clusters"
            className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            Vedi i 5 cluster pre-configurati →
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}

function ConsumoSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  mensileLabel,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  mensileLabel: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-stone-700">{label}</label>
        <span className="text-xs font-mono font-semibold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
          {NUM.format(value)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-700"
      />
      <div className="flex justify-between text-xs text-stone-500">
        <span>{NUM.format(min)}</span>
        <span>~{NUM.format(mensileLabel)}/mese</span>
        <span>{NUM.format(max)}</span>
      </div>
    </div>
  );
}

function BestOfferCard({
  title,
  ranked,
  volume,
  volumeUnit,
}: {
  title: string;
  ranked: OfferRanking[];
  volume: number;
  volumeUnit: string;
}) {
  if (ranked.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-sm font-semibold text-stone-700 mb-2">{title}</h3>
        <p className="text-sm text-stone-500">Nessuna offerta disponibile per questo profilo.</p>
      </div>
    );
  }

  if (volume === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-stone-300 p-6">
        <h3 className="text-sm font-semibold text-stone-700 mb-2">{title}</h3>
        <p className="text-sm text-stone-500">
          Sposta lo slider del consumo per vedere quale offerta tra le {ranked.length} attive costerebbe meno al tuo cliente.
        </p>
      </div>
    );
  }

  const winner = ranked[0];
  const runners = ranked.slice(1, 4);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-stone-700">{title}</h3>
      <div className="bg-emerald-50 border-l-4 border-emerald-600 rounded-r-lg p-4 space-y-2">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <span className="text-base font-bold text-stone-900">
            {winner.offer.supplier}
          </span>
          <span className="text-2xl font-bold text-emerald-900 tabular-nums">
            {EUR.format(winner.totalAnnualCostEur)}/anno
          </span>
        </div>
        <div className="text-xs text-stone-600">
          {winner.offer.offer_name ?? winner.offer.offer_code}
        </div>
        <div className="text-xs text-stone-700 flex flex-wrap gap-x-3">
          <span>
            {winner.offer.price_type === "fisso" ? "Prezzo fisso" : "Variabile"}: {winner.effectivePriceEurPerUnit.toFixed(4)} €/{volumeUnit}
          </span>
          {(winner.offer.fixed_cost_monthly ?? 0) > 0 && (
            <span>
              + {winner.offer.fixed_cost_monthly?.toFixed(2)} €/mese fisso
            </span>
          )}
        </div>
      </div>

      {runners.length > 0 && (
        <div className="space-y-1 relative">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-amber-600" aria-hidden />
              Top alternative
            </p>
            <Link
              href="/it/pro#early-access"
              className="text-[10px] font-bold uppercase text-amber-700 hover:text-amber-900 underline"
            >
              Sblocca Pro 499€
            </Link>
          </div>
          <ul
            className="space-y-1 text-sm select-none blur-[3px] pointer-events-none"
            aria-hidden
          >
            {runners.map((r, i) => (
              <li key={r.offer.offer_code} className="flex items-baseline justify-between text-xs">
                <span className="text-stone-600">{i + 2}° {r.offer.supplier}</span>
                <span className="tabular-nums text-stone-700">{EUR.format(r.totalAnnualCostEur)}/anno</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-stone-400">
        Ranked tra {ranked.length} offerte · consumo {NUM.format(volume)} {volumeUnit}/anno
      </p>
    </div>
  );
}

function TotalBolletta({
  rankedLuce,
  rankedGas,
  kwhAnno,
  smcAnno,
}: {
  rankedLuce: OfferRanking[];
  rankedGas: OfferRanking[];
  kwhAnno: number;
  smcAnno: number;
}) {
  const luce = rankedLuce[0];
  const gas = rankedGas[0];
  // Solo le voci con consumo > 0 contribuiscono al totale.
  const luceCost = kwhAnno > 0 ? (luce?.totalAnnualCostEur ?? 0) : 0;
  const gasCost = smcAnno > 0 ? (gas?.totalAnnualCostEur ?? 0) : 0;
  const total = luceCost + gasCost;

  // Nascondi finche' l'utente non ha mosso almeno uno slider.
  if (kwhAnno === 0 && smcAnno === 0) return null;
  if (!luce && !gas) return null;

  return (
    <div className="md:col-span-2 bg-stone-900 text-white rounded-xl p-6 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
        Bolletta totale stimata
      </h3>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="text-3xl font-bold tabular-nums">
          {EUR.format(total)}<span className="text-sm font-normal text-stone-400">/anno</span>
        </div>
        <div className="text-sm text-stone-300 tabular-nums">
          ~{EUR.format(total / 12)}/mese
        </div>
      </div>
      <p className="text-xs text-stone-400">
        Costo commodity. Non include accise, IVA, oneri di sistema e tariffe di distribuzione (mediamente +30-40% sulla bolletta finale).
      </p>
    </div>
  );
}
