import type { BenchmarkVerdict } from "@/lib/pro/margin-math";

const NUM_1DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface CompetitorData {
  medianEurPerMwh: number;
  p25EurPerMwh: number;
  p75EurPerMwh: number;
  nOfferte: number;
}

export function CompetitorBenchmark({
  yourSpread,
  competitor,
  verdict,
}: {
  yourSpread: number;
  competitor: CompetitorData;
  verdict: BenchmarkVerdict;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-stone-900">
          Posizionamento competitor
        </h3>
        <span className="text-xs text-stone-500 tabular-nums">
          {competitor.nOfferte} offerte ARERA
        </span>
      </div>
      <ul className="space-y-2 text-sm">
        <Row
          label="Spread mediano mercato"
          value={`+${NUM_1DP.format(competitor.medianEurPerMwh)} €/MWh`}
        />
        <Row
          label="Spread 25° percentile (sotto)"
          value={`+${NUM_1DP.format(competitor.p25EurPerMwh)} €/MWh`}
        />
        <Row
          label="Spread 75° percentile (sopra)"
          value={`+${NUM_1DP.format(competitor.p75EurPerMwh)} €/MWh`}
        />
        <li className="pt-2 mt-2 border-t border-stone-200 flex items-baseline justify-between gap-3">
          <span className="font-semibold text-stone-900">Il tuo spread</span>
          <span className="font-bold tabular-nums text-emerald-700">
            +{NUM_1DP.format(yourSpread)} €/MWh
          </span>
        </li>
      </ul>
      <p className="text-xs text-stone-600 italic pt-2 border-t border-stone-200">
        {verdict.label}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-stone-600">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </li>
  );
}
