"use client";

const NUM2 = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PCT0 = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface SparkData {
  current: number;
  percentiles: Record<string, number>;
  series: Array<{ date: string; value: number }>;
}

interface CrossSpreadData {
  current: number;
  series: Array<{ date: string; value: number }>;
}

interface CorrelationCell {
  assetA: string;
  assetB: string;
  correlation: number;
  nObs: number;
}

const ASSET_LABELS: Record<string, string> = {
  pun: "PUN",
  psv: "PSV",
  ttf: "TTF",
  brent: "Brent",
  co2: "CO2",
};

export function TradingVitalsView({
  spot,
  spark,
  crossSpreads,
  atr,
  correlation,
}: {
  spot: { pun: number; psv: number; ttf: number; brent: number; co2: number };
  spark: SparkData;
  crossSpreads: { punPsv: CrossSpreadData; psvTtf: CrossSpreadData };
  atr: {
    pun: number | null;
    psv: number | null;
    ttf: number | null;
    brent: number | null;
    co2: number | null;
  };
  correlation: CorrelationCell[];
}) {
  // Posizione spark spread corrente nei percentili
  const sparkP = spark.current;
  const p50 = spark.percentiles["0.5"];
  const p25 = spark.percentiles["0.25"];
  const p75 = spark.percentiles["0.75"];
  let sparkLabel = "Mediana storica";
  let sparkColor = "text-stone-700";
  let sparkBg = "bg-stone-50";
  if (sparkP > p75) {
    sparkLabel = "Sopra 75° percentile — CCGT redditizio";
    sparkColor = "text-emerald-700";
    sparkBg = "bg-emerald-50";
  } else if (sparkP < p25) {
    sparkLabel = "Sotto 25° percentile — vicino shutdown";
    sparkColor = "text-rose-700";
    sparkBg = "bg-rose-50";
  }

  return (
    <div className="space-y-6">
      {/* 1. SPARK SPREAD */}
      <section className={`rounded-2xl border border-stone-200 p-6 ${sparkBg}`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xs uppercase tracking-wide text-stone-500 font-semibold">
              Spark Spread Italia
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              PUN − PSV × 1.8 − CO2 × 0.35 (CCGT moderno)
            </p>
            <div className={`mt-3 text-4xl font-bold tabular-nums ${sparkColor}`}>
              {sparkP >= 0 ? "+" : ""}
              {NUM2.format(sparkP)}{" "}
              <span className="text-base font-normal text-stone-500">€/MWh</span>
            </div>
            <p className={`mt-1 text-sm font-medium ${sparkColor}`}>{sparkLabel}</p>
          </div>
          <div className="text-xs text-stone-600 grid grid-cols-2 gap-x-4 gap-y-1">
            <span>10° pct</span>
            <span className="tabular-nums text-right font-mono">
              {NUM2.format(spark.percentiles["0.1"])}
            </span>
            <span>25° pct</span>
            <span className="tabular-nums text-right font-mono">{NUM2.format(p25)}</span>
            <span className="font-semibold">Mediana</span>
            <span className="tabular-nums text-right font-mono font-semibold">
              {NUM2.format(p50)}
            </span>
            <span>75° pct</span>
            <span className="tabular-nums text-right font-mono">{NUM2.format(p75)}</span>
            <span>90° pct</span>
            <span className="tabular-nums text-right font-mono">
              {NUM2.format(spark.percentiles["0.9"])}
            </span>
          </div>
        </div>

        {/* Mini sparkline area chart con SVG inline */}
        <div className="mt-4">
          <SparkSparkline points={spark.series} median={p50} />
        </div>
      </section>

      {/* 2. CROSS SPREADS */}
      <div className="grid gap-4 md:grid-cols-2">
        <CrossSpreadCard
          title="PUN − PSV (power premium)"
          subtitle="Differenza diretta in €/MWh tra mercato elettrico e gas italiano"
          data={crossSpreads.punPsv}
          color="emerald"
        />
        <CrossSpreadCard
          title="PSV − TTF (premio Italia gas)"
          subtitle="Spread tra gas italiano e hub europeo — tipico 1-3 €/MWh"
          data={crossSpreads.psvTtf}
          color="amber"
        />
      </div>

      {/* 3. VOLATILITY ATR */}
      <section className="rounded-2xl border border-stone-200 p-6 bg-white">
        <h2 className="text-xs uppercase tracking-wide text-stone-500 font-semibold mb-3">
          Volatility ATR 14 giorni
        </h2>
        <p className="text-xs text-stone-600 mb-4">
          Variazione media giornaliera assoluta. Soglie indicative: alto &gt; 5 €/MWh per
          power/gas.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(["pun", "psv", "ttf", "brent", "co2"] as const).map((slug) => {
            const a = atr[slug];
            const spotV = spot[slug];
            const pctOfSpot = a !== null && spotV > 0 ? a / spotV : null;
            return (
              <div key={slug} className="rounded-lg border border-stone-200 p-3 bg-stone-50/50">
                <div className="text-xs text-stone-500 uppercase">{ASSET_LABELS[slug]}</div>
                <div className="text-xl font-bold tabular-nums mt-1">
                  {a !== null ? NUM2.format(a) : "—"}
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  {pctOfSpot !== null ? `${PCT0.format(pctOfSpot)} di spot` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. CORRELATION MATRIX */}
      <section className="rounded-2xl border border-stone-200 p-6 bg-white">
        <h2 className="text-xs uppercase tracking-wide text-stone-500 font-semibold mb-3">
          Correlation matrix 30g
        </h2>
        <p className="text-xs text-stone-600 mb-4">
          Correlazione di Pearson su log-returns giornalieri. Verde = positiva, rosso = inversa.
        </p>
        <CorrelationHeatmap cells={correlation} />
      </section>
    </div>
  );
}

// ---- SPARKLINE inline SVG (no libraries) ----

function SparkSparkline({
  points,
  median,
}: {
  points: Array<{ date: string; value: number }>;
  median: number;
}) {
  if (points.length === 0)
    return <div className="h-24 text-xs text-stone-400">Storico non disponibile</div>;
  const W = 800;
  const H = 100;
  const PAD = 4;
  const values = points.map((p) => p.value);
  const minV = Math.min(...values, median);
  const maxV = Math.max(...values, median);
  const range = maxV - minV || 1;
  const xs = points.map((_, i) => PAD + ((W - PAD * 2) * i) / Math.max(1, points.length - 1));
  const ys = points.map((p) => H - PAD - ((p.value - minV) / range) * (H - PAD * 2));
  const medianY = H - PAD - ((median - minV) / range) * (H - PAD * 2);
  const path = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");
  const areaPath = path + ` L${xs[xs.length - 1].toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
      <path d={areaPath} fill="rgba(16,185,129,0.15)" />
      <path d={path} fill="none" stroke="#10b981" strokeWidth="1.5" />
      <line
        x1={PAD}
        x2={W - PAD}
        y1={medianY}
        y2={medianY}
        stroke="#78716c"
        strokeWidth="0.8"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

function CrossSpreadCard({
  title,
  subtitle,
  data,
  color,
}: {
  title: string;
  subtitle: string;
  data: CrossSpreadData;
  color: "emerald" | "amber";
}) {
  const positive = data.current >= 0;
  const valueColor = color === "emerald" ? "text-emerald-700" : "text-amber-700";
  const lineColor = color === "emerald" ? "#10b981" : "#f59e0b";

  // semplice sparkline
  const W = 400,
    H = 60,
    PAD = 2;
  const values = data.series.map((p) => p.value);
  let path = "";
  if (values.length > 1) {
    const minV = Math.min(...values, 0);
    const maxV = Math.max(...values, 0);
    const range = maxV - minV || 1;
    const xs = values.map((_, i) => PAD + ((W - PAD * 2) * i) / (values.length - 1));
    const ys = values.map((v) => H - PAD - ((v - minV) / range) * (H - PAD * 2));
    path = xs
      .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
      .join(" ");
  }

  return (
    <section className="rounded-2xl border border-stone-200 p-5 bg-white space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        <p className="text-xs text-stone-500">{subtitle}</p>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>
        {positive ? "+" : ""}
        {NUM2.format(data.current)}{" "}
        <span className="text-sm font-normal text-stone-500">€/MWh</span>
      </div>
      {path && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
          <path d={path} fill="none" stroke={lineColor} strokeWidth="1.5" />
        </svg>
      )}
    </section>
  );
}

function CorrelationHeatmap({ cells }: { cells: CorrelationCell[] }) {
  const assets = [...new Set(cells.map((c) => c.assetA))].sort();

  function corrColor(r: number): string {
    if (Number.isNaN(r)) return "bg-stone-100";
    if (r > 0.7) return "bg-emerald-300";
    if (r > 0.4) return "bg-emerald-200";
    if (r > 0.1) return "bg-emerald-100";
    if (r > -0.1) return "bg-stone-100";
    if (r > -0.4) return "bg-rose-100";
    if (r > -0.7) return "bg-rose-200";
    return "bg-rose-300";
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2"></th>
            {assets.map((a) => (
              <th
                key={a}
                className="p-2 font-semibold text-stone-600 uppercase text-[10px]"
              >
                {ASSET_LABELS[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((rowA) => (
            <tr key={rowA}>
              <td className="p-2 font-semibold text-stone-600 uppercase text-[10px]">
                {ASSET_LABELS[rowA]}
              </td>
              {assets.map((colB) => {
                const cell = cells.find((c) => c.assetA === rowA && c.assetB === colB);
                const r = cell?.correlation ?? Number.NaN;
                return (
                  <td
                    key={colB}
                    className={`p-2 text-center tabular-nums font-mono font-semibold text-stone-800 ${corrColor(r)} border border-white`}
                  >
                    {Number.isNaN(r) ? "—" : r.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
