"use client";

import { useEffect, useMemo } from "react";
import type { Offer } from "./MarketMap";
import { annualCommodityCost, isCertificateOffer } from "./MarketMap";

const NUM = new Intl.NumberFormat("it-IT");
const NUM_2DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM_4DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const EUR_INT = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface BestOffer {
  offer: Offer;
  totalEurAnno: number;
}

/**
 * Trova la migliore offerta per commodity al volume dato.
 * Esclude offerte con pcvEurAnno <= 0: per le offerte nel DB un PCV = 0
 * indica "dato mancante" piu' che "quota fissa zero" (le offerte legittime
 * hanno sempre un PCV > 0 tipicamente 60-200 €/anno). Includerle
 * inquinerebbe il "migliore" facendo apparire offerte incomplete in cima.
 */
function findBest(offers: Offer[], commodity: "electricity" | "gas", volume: number): BestOffer | null {
  if (volume <= 0) return null;
  const candidates = offers.filter(
    (o) => o.commodity === commodity && o.pcvEurAnno > 0,
  );
  if (candidates.length === 0) return null;
  let best: BestOffer | null = null;
  for (const o of candidates) {
    const total = annualCommodityCost(o, volume);
    if (best === null || total < best.totalEurAnno) {
      best = { offer: o, totalEurAnno: total };
    }
  }
  return best;
}

/**
 * Tool sotto la Market Map. Due slider luce + gas → calcola in tempo
 * reale la migliore offerta per commodity e ritorna i codici delle
 * offerte vincenti al MarketMap (per highlight tile).
 *
 * Riceve `offers` (gia' filtrato per source/cert dal wrapper se serve) e
 * la callback `onWinnersChange(codes)` per condividere lo state up.
 *
 * Sliders sono "controlled": value/onChange forniti dal wrapper. Cosi' il
 * MarketMap puo' usare gli stessi volumi quando l'utente sceglie sortMode
 * "consumo" — un'unica fonte di verita' per la simulazione.
 */
export function MarketMapSimulator({
  offers,
  onWinnersChange,
  kwhAnno,
  smcAnno,
  onKwhAnnoChange,
  onSmcAnnoChange,
}: {
  offers: Offer[];
  onWinnersChange: (codes: string[]) => void;
  kwhAnno: number;
  smcAnno: number;
  onKwhAnnoChange: (v: number) => void;
  onSmcAnnoChange: (v: number) => void;
}) {
  const bestLuce = useMemo(() => findBest(offers, "electricity", kwhAnno), [offers, kwhAnno]);
  const bestGas = useMemo(() => findBest(offers, "gas", smcAnno), [offers, smcAnno]);

  // Notifica il wrapper dei winner per highlight tile.
  // useEffect (no useMemo) perche' onWinnersChange e' un side effect.
  useEffect(() => {
    const winners: string[] = [];
    if (bestLuce) winners.push(bestLuce.offer.codice);
    if (bestGas) winners.push(bestGas.offer.codice);
    onWinnersChange(winners);
  }, [bestLuce, bestGas, onWinnersChange]);

  const totaleBolletta =
    (bestLuce?.totalEurAnno ?? 0) + (bestGas?.totalEurAnno ?? 0);

  return (
    <section
      aria-labelledby="simulator-title"
      className="relative z-10 mt-10 max-w-[1600px] mx-auto rounded-2xl border border-emerald-400/30 bg-black/60 backdrop-blur-md p-6 sm:p-8 space-y-6"
    >
      <header className="space-y-1">
        <h2
          id="simulator-title"
          className="text-2xl sm:text-3xl font-mono font-bold text-emerald-300 tracking-wider"
        >
          CALCOLA LA TUA BOLLETTA
        </h2>
        <p className="text-emerald-300/60 font-mono text-xs sm:text-sm">
          Muovi gli slider per consumo annuo · ricerca live tra le offerte visibili sopra ·
          le tile vincenti si illuminano sulla mappa
        </p>
      </header>

      {/* SLIDER PANEL */}
      <div className="grid gap-6 md:grid-cols-2">
        <ConsumoSlider
          label="Consumo luce"
          unitShort="kWh"
          unitLong="kWh/anno"
          value={kwhAnno}
          min={0}
          max={10000}
          step={100}
          onChange={onKwhAnnoChange}
          mensile={Math.round(kwhAnno / 12)}
        />
        <ConsumoSlider
          label="Consumo gas"
          unitShort="Smc"
          unitLong="Smc/anno"
          value={smcAnno}
          min={0}
          max={3000}
          step={50}
          onChange={onSmcAnnoChange}
          mensile={Math.round(smcAnno / 12)}
        />
      </div>

      {/* WINNER CARDS */}
      <div className="grid gap-4 md:grid-cols-2">
        <WinnerCard
          title="Migliore offerta luce"
          accent="emerald"
          best={bestLuce}
          volume={kwhAnno}
          unit="kWh"
          unitPrice="€/kWh"
        />
        <WinnerCard
          title="Migliore offerta gas"
          accent="amber"
          best={bestGas}
          volume={smcAnno}
          unit="Smc"
          unitPrice="€/Smc"
        />
      </div>

      {/* TOTAL BOLLETTA */}
      {(kwhAnno > 0 || smcAnno > 0) && totaleBolletta > 0 && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-4 sm:p-5 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-300/70">
              Bolletta totale stimata (commodity)
            </p>
            <p className="text-3xl sm:text-4xl font-mono font-bold text-emerald-300 tabular-nums">
              {EUR_INT.format(totaleBolletta)}
              <span className="text-sm font-normal text-emerald-300/60 ml-1">/anno</span>
            </p>
            <p className="text-xs text-emerald-300/50 font-mono mt-1">
              ~{EUR_INT.format(totaleBolletta / 12)}/mese
            </p>
          </div>
          <p className="text-[10px] text-emerald-300/40 font-mono italic max-w-md text-right">
            Solo costo materia + commercializzazione (PCV). Non include accise, IVA,
            oneri di sistema, distribuzione — la bolletta finale e&apos; +30/40%.
          </p>
        </div>
      )}
    </section>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function ConsumoSlider({
  label,
  unitShort,
  unitLong,
  value,
  min,
  max,
  step,
  onChange,
  mensile,
}: {
  label: string;
  unitShort: string;
  unitLong: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  mensile: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-mono uppercase tracking-widest text-emerald-300/70">
          {label}
        </label>
        <span className="text-xs font-mono font-bold bg-emerald-400/15 text-emerald-300 px-2 py-0.5 rounded tabular-nums">
          {NUM.format(value)} {unitShort}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-400 cursor-pointer"
        aria-label={`${label} in ${unitLong}`}
      />
      <div className="flex justify-between text-[10px] font-mono text-emerald-300/40 tabular-nums">
        <span>0</span>
        <span>~{NUM.format(mensile)} {unitShort}/mese</span>
        <span>{NUM.format(max)}</span>
      </div>
    </div>
  );
}

function WinnerCard({
  title,
  accent,
  best,
  volume,
  unit,
  unitPrice,
}: {
  title: string;
  accent: "emerald" | "amber";
  best: BestOffer | null;
  volume: number;
  unit: string;
  unitPrice: string;
}) {
  const accentClasses =
    accent === "emerald"
      ? {
          border: "border-emerald-400/30",
          bg: "bg-emerald-400/5",
          text: "text-emerald-300",
          mute: "text-emerald-300/60",
          title: "text-emerald-300",
          badge: "bg-emerald-400/20 text-emerald-300",
        }
      : {
          border: "border-amber-400/30",
          bg: "bg-amber-400/5",
          text: "text-amber-300",
          mute: "text-amber-300/60",
          title: "text-amber-300",
          badge: "bg-amber-400/20 text-amber-300",
        };

  if (volume === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed ${accentClasses.border} bg-black/40 p-4 sm:p-5 space-y-1`}
      >
        <h3 className={`text-xs font-mono uppercase tracking-widest ${accentClasses.mute}`}>
          {title}
        </h3>
        <p className={`text-sm font-mono ${accentClasses.mute}`}>
          Muovi lo slider per vedere la migliore offerta.
        </p>
      </div>
    );
  }

  if (!best) {
    return (
      <div
        className={`rounded-xl border border-dashed ${accentClasses.border} bg-black/40 p-4 sm:p-5 space-y-1`}
      >
        <h3 className={`text-xs font-mono uppercase tracking-widest ${accentClasses.mute}`}>
          {title}
        </h3>
        <p className={`text-sm font-mono ${accentClasses.mute}`}>
          Nessuna offerta disponibile.
        </p>
      </div>
    );
  }

  const o = best.offer;
  const isCert = isCertificateOffer(o);
  return (
    <div
      className={`rounded-xl border ${accentClasses.border} ${accentClasses.bg} p-4 sm:p-5 space-y-3`}
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className={`text-xs font-mono uppercase tracking-widest ${accentClasses.mute}`}>
          {title}
        </h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest ${
            isCert
              ? "bg-emerald-400/20 text-emerald-300"
              : "bg-amber-300/20 text-amber-300"
          }`}
        >
          <span aria-hidden>{isCert ? "✓" : "⚠"}</span>{" "}
          {isCert ? "Certificate" : "Non certificate"}
        </span>
      </div>
      <div>
        <p className={`text-lg sm:text-xl font-mono font-bold ${accentClasses.title}`}>
          {o.vendor}
        </p>
        <p className={`text-[11px] font-mono ${accentClasses.mute} truncate`}>{o.codice}</p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs font-mono">
        <span className={accentClasses.mute}>
          Tipo:{" "}
          <strong className={accentClasses.text}>
            {o.priceType === "fisso" ? "Fisso" : "Variabile"}
          </strong>
        </span>
        <span className={accentClasses.mute}>
          Prezzo:{" "}
          <strong className={`tabular-nums ${accentClasses.text}`}>
            {NUM_4DP.format(o.price)} {unitPrice}
          </strong>
        </span>
        <span className={accentClasses.mute}>
          PCV:{" "}
          <strong className={`tabular-nums ${accentClasses.text}`}>
            {NUM_2DP.format(o.pcvEurAnno)} €/anno
          </strong>
        </span>
      </div>
      <div className="pt-2 border-t border-emerald-400/10">
        <p className={`text-[10px] uppercase tracking-widest ${accentClasses.mute}`}>
          Bolletta annua stimata (su {NUM.format(volume)} {unit}/anno)
        </p>
        <p className={`text-2xl sm:text-3xl font-mono font-bold tabular-nums ${accentClasses.title}`}>
          {EUR_INT.format(best.totalEurAnno)}
          <span className={`text-xs font-normal ml-1 ${accentClasses.mute}`}>/anno</span>
        </p>
      </div>
    </div>
  );
}
