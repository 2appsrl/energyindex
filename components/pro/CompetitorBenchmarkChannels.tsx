import { Lock } from "lucide-react";
import type { BenchmarkVerdict } from "@/lib/pro/margin-math";
import {
  CHANNEL_META,
  CHANNEL_SMALL_SAMPLE,
  channelPosition,
  isChannelUsable,
  type ChannelSpreadStats,
} from "@/lib/pro/channel-benchmark";
import { InfoTooltip } from "./InfoTooltip";

const NUM_1DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const TONE_CLASS: Record<string, string> = {
  sotto: "bg-emerald-50 text-emerald-700",
  inlinea: "bg-stone-100 text-stone-600",
  sopra: "bg-amber-50 text-amber-700",
};

/**
 * Posizionamento competitor a 3 canali: fasce p25–p75 per canale con tacca
 * sulla mediana e linea verticale sul tuo spread (vista principale), piu'
 * i numeri compatti per canale sotto.
 */
export function CompetitorBenchmarkChannels({
  yourSpread,
  channels,
  verdict,
}: {
  yourSpread: number;
  channels: ChannelSpreadStats[];
  verdict: BenchmarkVerdict;
}) {
  // Scala comune 0..max: tutte le fasce + il tuo spread devono starci.
  const maxVal = Math.max(
    yourSpread,
    ...channels.map((c) => c.p75EurPerMwh ?? 0),
    1,
  );
  const scaleMax = maxVal * 1.12;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / scaleMax) * 100))}%`;
  const youPct = pct(yourSpread);
  // Vicino ai bordi il flag non si centra sul marker, per non uscire dalla card.
  const youPctNum = Math.min(100, Math.max(0, (yourSpread / scaleMax) * 100));
  const flagShift =
    youPctNum < 8 ? "" : youPctNum > 92 ? "-translate-x-full" : "-translate-x-1/2";

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-stone-900 flex items-center">
          Posizionamento competitor — 3 canali
          <InfoTooltip
            label="Posizionamento competitor"
            text="Confronto del tuo spread con tre canali di prezzo: PLACET ARERA (offerte standardizzate regolate), EnergiaPro (offerte commerciali del canale broker) e Online brand (offerte sui siti dei fornitori, via scraping). Fascia = 25°-75° percentile, tacca = mediana, linea nera = il tuo spread."
          />
        </h3>
        <span className="text-xs text-stone-500 tabular-nums">€/MWh</span>
      </div>

      {/* FASCE PER CANALE */}
      <div className="space-y-3">
        <div className="relative h-5" aria-hidden>
          <span
            className={`absolute top-0 rounded bg-stone-900 px-1.5 py-px text-[10px] font-semibold text-white whitespace-nowrap ${flagShift}`}
            style={{ left: youPct }}
          >
            tu: +{NUM_1DP.format(yourSpread)}
          </span>
        </div>
        {channels.map((c) => {
          const meta = CHANNEL_META[c.channel];
          const usable = isChannelUsable(c);
          return (
            <div key={c.channel} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-sm ${meta.dotClass}`}
                    aria-hidden
                  />
                  {meta.label}
                </span>
                <span className="text-[11px] text-stone-400 tabular-nums inline-flex items-center gap-1">
                  {c.locked ? (
                    <>
                      <Lock className="h-3 w-3 text-amber-600" aria-hidden />
                      {c.nOfferte > 0
                        ? `${c.nOfferte} ${c.nOfferte === 1 ? "offerta" : "offerte"} · riservato Pro`
                        : "riservato Pro"}
                    </>
                  ) : usable ? (
                    `${c.nOfferte} ${c.nOfferte === 1 ? "offerta" : "offerte"}${c.nOfferte < CHANNEL_SMALL_SAMPLE ? " · campione ridotto" : ""}`
                  ) : (
                    "in costruzione"
                  )}
                </span>
              </div>
              <div className="relative h-7 rounded-md bg-stone-50">
                {usable && (
                  <>
                    <div
                      className={`absolute top-1 bottom-1 rounded ${meta.dotClass} opacity-25`}
                      style={{
                        left: pct(c.p25EurPerMwh as number),
                        width: `calc(${pct(c.p75EurPerMwh as number)} - ${pct(c.p25EurPerMwh as number)})`,
                      }}
                    />
                    <div
                      className={`absolute top-0.5 bottom-0.5 w-[3px] rounded ${meta.dotClass}`}
                      style={{ left: pct(c.medianEurPerMwh as number) }}
                    />
                  </>
                )}
                <div
                  className="absolute -top-1 -bottom-1 w-[2px] bg-stone-900"
                  style={{ left: youPct }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* NUMERI COMPATTI */}
      <ul className="space-y-1.5 pt-2 border-t border-stone-200 text-xs">
        {channels.map((c) => {
          const meta = CHANNEL_META[c.channel];
          const pos = channelPosition(yourSpread, c);
          return (
            <li
              key={c.channel}
              className="flex items-baseline justify-between gap-2 text-stone-600"
            >
              <span className="shrink-0">{meta.short}</span>
              {isChannelUsable(c) ? (
                <span className="flex items-baseline gap-2 tabular-nums">
                  <span>
                    {NUM_1DP.format(c.p25EurPerMwh as number)} ·{" "}
                    <strong className="text-stone-800">
                      {NUM_1DP.format(c.medianEurPerMwh as number)}
                    </strong>{" "}
                    · {NUM_1DP.format(c.p75EurPerMwh as number)}
                  </span>
                  {pos && (
                    <span
                      className={`rounded-full px-2 py-px font-semibold whitespace-nowrap ${TONE_CLASS[pos.tone]}`}
                    >
                      {pos.label}
                    </span>
                  )}
                </span>
              ) : c.locked ? (
                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                  <Lock className="h-3 w-3" aria-hidden />
                  visibile con Pro 499€/mese
                </span>
              ) : (
                <span className="text-stone-400">
                  scraper siti brand in arrivo
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-stone-600 italic pt-2 border-t border-stone-200">
        {verdict.label}
      </p>
      <p className="text-xs text-stone-500">
        Fonti: Portale Offerte ARERA (open data PLACET + mercato libero) ·
        EnergiaPro API · scraping siti brand. Percentili p25 · mediana · p75.
      </p>
    </div>
  );
}
