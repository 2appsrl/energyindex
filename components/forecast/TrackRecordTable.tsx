export interface TrackRecordRow {
  asset_slug: string;
  display_name_it: string;
  horizon_days: number;
  period_start: string;
  period_end: string;
  mape: number | null;
  rmse: number | null;
  hit_ratio: number | null;
  coverage: number | null;
  n_observations: number;
}

function pctOrDash(v: number | null, digits = 2): string {
  if (v === null) return "—";
  return `${v.toFixed(digits)}%`;
}

function ratioOrDash(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

/**
 * Render tabella MAPE/RMSE/hit/coverage per asset × horizon.
 * Si raggruppa per asset; ogni horizon e' una colonna.
 */
export function TrackRecordTable({ rows }: { rows: TrackRecordRow[] }) {
  const byAsset = new Map<string, TrackRecordRow[]>();
  for (const r of rows) {
    const list = byAsset.get(r.asset_slug) ?? [];
    list.push(r);
    byAsset.set(r.asset_slug, list);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-4">Asset</th>
            <th className="text-left py-2 pr-4">Orizzonte</th>
            <th className="text-right py-2 px-3">MAPE</th>
            <th className="text-right py-2 px-3">RMSE</th>
            <th className="text-right py-2 px-3">Hit ratio</th>
            <th className="text-right py-2 px-3">Coverage 90%</th>
            <th className="text-right py-2 pl-3">N osservazioni</th>
          </tr>
        </thead>
        <tbody>
          {[...byAsset.values()].flat().map((r) => (
            <tr key={`${r.asset_slug}-${r.horizon_days}`} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium">{r.display_name_it}</td>
              <td className="py-2 pr-4">{r.horizon_days}g</td>
              <td className="py-2 px-3 text-right tabular-nums">{pctOrDash(r.mape)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{r.rmse?.toFixed(2) ?? "—"}</td>
              <td className="py-2 px-3 text-right tabular-nums">{ratioOrDash(r.hit_ratio)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{ratioOrDash(r.coverage)}</td>
              <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">{r.n_observations}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        MAPE = errore percentuale assoluto medio. Hit ratio = % indovinata direzione (up/down). Coverage = % del valore reale dentro la banda 5–95%.
      </p>
    </div>
  );
}
