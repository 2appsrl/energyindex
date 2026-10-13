/**
 * Benchmark competitor a 3 canali (RPC get_competitor_spread_stats_channels).
 * Ogni canale di prezzo racconta un mercato diverso:
 *   - placet_arera: offerte standardizzate regolate (pavimento di riferimento)
 *   - energiapro:   offerte commerciali del canale broker (energiapro.biz)
 *   - online_brand: offerte pubblicate sui siti dei brand (scraping)
 */

export type BenchmarkChannelId = "placet_arera" | "energiapro" | "online_brand";

export interface ChannelSpreadStats {
  channel: BenchmarkChannelId;
  /** NULL quando il canale non ha offerte (n_offerte = 0). */
  p25EurPerMwh: number | null;
  medianEurPerMwh: number | null;
  p75EurPerMwh: number | null;
  nOfferte: number;
  /**
   * Canale riservato al tier Pro: i percentili vengono azzerati lato server
   * prima di arrivare al client demo; resta solo nOfferte come teaser.
   */
  locked?: boolean;
}

/** Sotto questa soglia il canale non mostra percentili ("in costruzione"). */
export const CHANNEL_MIN_SAMPLE = 3;
/** Sotto questa soglia il canale mostra il badge "campione ridotto". */
export const CHANNEL_SMALL_SAMPLE = 10;

export const CHANNEL_ORDER: BenchmarkChannelId[] = [
  "placet_arera",
  "energiapro",
  "online_brand",
];

export const CHANNEL_META: Record<
  BenchmarkChannelId,
  { label: string; short: string; description: string; dotClass: string }
> = {
  placet_arera: {
    label: "PLACET ARERA",
    short: "PLACET",
    description: "Offerte standardizzate del Portale Offerte ARERA (open data).",
    dotClass: "bg-amber-500",
  },
  energiapro: {
    label: "EnergiaPro",
    short: "EnergiaPro",
    description: "Offerte commerciali del canale broker (energiapro.biz).",
    dotClass: "bg-emerald-500",
  },
  online_brand: {
    label: "Online brand",
    short: "Online",
    description: "Offerte pubblicate sui siti dei brand (scraping giornaliero).",
    dotClass: "bg-sky-500",
  },
};

export interface ChannelRpcRow {
  channel: string;
  p25_eur_mwh: number | string | null;
  median_eur_mwh: number | string | null;
  p75_eur_mwh: number | string | null;
  n_offerte: number;
}

/**
 * Normalizza le righe RPC in CHANNEL_ORDER; i canali mancanti (RPC fallita o
 * riga assente) diventano canali vuoti, cosi' la UI resta deterministica.
 */
export function parseChannelRows(raw: unknown): ChannelSpreadStats[] {
  const rows = Array.isArray(raw) ? (raw as ChannelRpcRow[]) : [];
  return CHANNEL_ORDER.map((id) => {
    const r = rows.find((x) => x.channel === id);
    if (!r || r.n_offerte < CHANNEL_MIN_SAMPLE) {
      return {
        channel: id,
        p25EurPerMwh: null,
        medianEurPerMwh: null,
        p75EurPerMwh: null,
        nOfferte: r?.n_offerte ?? 0,
      };
    }
    return {
      channel: id,
      p25EurPerMwh: r.p25_eur_mwh === null ? null : Number(r.p25_eur_mwh),
      medianEurPerMwh: r.median_eur_mwh === null ? null : Number(r.median_eur_mwh),
      p75EurPerMwh: r.p75_eur_mwh === null ? null : Number(r.p75_eur_mwh),
      nOfferte: r.n_offerte,
    };
  });
}

/**
 * Paywall demo: i dati del canale online_brand (scraping siti fornitori)
 * sono visibili solo col tier Pro. Da chiamare NELLE PAGINE SERVER prima di
 * passare i canali al client: azzera i percentili, tiene nOfferte (teaser
 * "N offerte · riservato Pro") e marca locked. Quando esistera' l'auth a
 * tier, la chiamata diventera' condizionale sul piano dell'utente.
 */
export function lockProChannels(
  channels: ChannelSpreadStats[],
  lockedIds: BenchmarkChannelId[] = ["online_brand"],
): ChannelSpreadStats[] {
  return channels.map((c) =>
    lockedIds.includes(c.channel)
      ? {
          ...c,
          p25EurPerMwh: null,
          medianEurPerMwh: null,
          p75EurPerMwh: null,
          locked: true,
        }
      : c,
  );
}

/** Un canale e' utilizzabile se ha percentili e campione >= soglia minima. */
export function isChannelUsable(c: ChannelSpreadStats): boolean {
  return (
    c.nOfferte >= CHANNEL_MIN_SAMPLE &&
    c.medianEurPerMwh !== null &&
    c.p25EurPerMwh !== null &&
    c.p75EurPerMwh !== null
  );
}

/**
 * Canale di riferimento per verdict e price ladder: le offerte commerciali
 * sono piu' rappresentative del mercato vero delle PLACET regolate, quindi
 * energiapro > online_brand > placet_arera (primo con campione sufficiente).
 */
export function pickReferenceChannel(
  channels: ChannelSpreadStats[],
): ChannelSpreadStats | null {
  const priority: BenchmarkChannelId[] = ["energiapro", "online_brand", "placet_arera"];
  for (const id of priority) {
    const c = channels.find((x) => x.channel === id);
    if (c && isChannelUsable(c)) return c;
  }
  return null;
}

export interface ChannelPosition {
  label: string;
  tone: "sotto" | "inlinea" | "sopra";
}

/** Posizione del tuo spread rispetto a un canale, per il chip nella UI. */
export function channelPosition(
  yourSpread: number,
  c: ChannelSpreadStats,
): ChannelPosition | null {
  if (!isChannelUsable(c)) return null;
  const median = c.medianEurPerMwh as number;
  const p25 = c.p25EurPerMwh as number;
  const p75 = c.p75EurPerMwh as number;
  const deltaPct = median !== 0 ? ((yourSpread - median) / Math.abs(median)) * 100 : 0;

  if (yourSpread < p25) return { label: "sotto il 25°", tone: "sotto" };
  if (deltaPct < -10)
    return { label: `${Math.round(deltaPct)}% vs mediana`, tone: "sotto" };
  if (deltaPct <= 10) return { label: "in mediana", tone: "inlinea" };
  if (yourSpread <= p75)
    return { label: `+${Math.round(deltaPct)}% vs mediana`, tone: "sopra" };
  return { label: "oltre il 75°", tone: "sopra" };
}
