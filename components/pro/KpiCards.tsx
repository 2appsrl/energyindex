import type { KpiResult } from "@/lib/pro/margin-math";

const NUM_2DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const EUR_INT = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function KpiCards({ kpi }: { kpi: KpiResult }) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <Card
        label="Costo approv. medio"
        value={NUM_2DP.format(kpi.costoApprovvigionamentoEurPerMwh)}
        unit="€/MWh"
      />
      <Card
        label="Prezzo vendita"
        value={NUM_2DP.format(kpi.prezzoVenditaEurPerMwh)}
        unit="€/MWh"
      />
      <Card
        label="Margine cliente/anno"
        value={EUR_INT.format(kpi.margineAnnoEur)}
        highlight
      />
      <Card
        label="LTV contratto"
        value={EUR_INT.format(kpi.ltvContrattoEur)}
        sublabel="netto di churn + CAC"
      />
    </div>
  );
}

function Card({
  label,
  value,
  unit,
  sublabel,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "p-4 rounded-xl border border-l-4 border-emerald-600 bg-emerald-50/60 shadow-sm"
          : "p-4 rounded-xl border border-stone-200 bg-white"
      }
    >
      <div className="text-xs text-stone-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-stone-900">
        {value}
      </div>
      {unit && <div className="text-xs text-stone-500">{unit}</div>}
      {sublabel && (
        <div className="text-xs text-stone-500 mt-1">{sublabel}</div>
      )}
    </div>
  );
}
