"use client";

import {
  ForecastChart,
  type ForecastChartPoint,
} from "@/components/forecast/ForecastChart";

/**
 * Wrapper di ForecastChart per la sezione EIDX Pro:
 *  - cornice card chiara
 *  - forza il tema light a prescindere dalla preferenza utente
 *  - titolo dinamico con la durata contratto selezionata
 */
export function SimulatorChart({
  points,
  contractMonths,
}: {
  points: ForecastChartPoint[];
  contractMonths: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-stone-900">
          Forecast PUN &mdash; {contractMonths} mesi
        </h3>
        <span className="text-xs text-stone-500">€/MWh &middot; banda 5–95%</span>
      </div>
      <ForecastChart points={points} unit="€/MWh" forceTheme="light" />
    </div>
  );
}
