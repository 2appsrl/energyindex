import type { KpiResult, ScenarioModifier } from "@/lib/pro/margin-math";
import { InfoTooltip } from "./InfoTooltip";

const EUR_INT = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function ScenarioStress({
  rows,
  baseMargineAnno,
}: {
  rows: { scenario: ScenarioModifier; kpi: KpiResult }[];
  baseMargineAnno: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <h3 className="font-semibold text-stone-900 flex items-center">
        Scenario stress
        <InfoTooltip
          label="Scenari stress"
          text="Come cambia il margine se il mercato si muove. Inverno freddo aumenta i consumi (volume +10%). TTF +20% aumenta il costo gas (+8 EUR/MWh): in contratti variabili passa al cliente, in contratti fissi te lo mangi. Recessione domanda riduce i volumi (-5%)."
        />
      </h3>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => {
          const delta = r.kpi.margineAnnoEur - baseMargineAnno;
          const isBase = r.scenario.name === "base";
          const valueClass = isBase
            ? "text-stone-900"
            : delta >= 0
              ? "text-emerald-700"
              : "text-rose-600";
          return (
            <li
              key={r.scenario.name}
              className="flex items-baseline justify-between gap-3"
            >
              <span
                className={
                  isBase
                    ? "text-stone-700 font-medium"
                    : "text-stone-600"
                }
              >
                {r.scenario.label}
              </span>
              <span className={`tabular-nums font-medium ${valueClass}`}>
                {EUR_INT.format(r.kpi.margineAnnoEur)}
                {!isBase && (
                  <span className="text-xs ml-1 text-stone-500">
                    ({delta >= 0 ? "+" : ""}
                    {EUR_INT.format(delta)})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
