/**
 * Conversioni orarie sul fuso Europe/Rome, DST-aware. Pure e senza
 * dipendenze: usate dall'Edge Function (Deno), dagli script (Node) e dalla
 * home (Next.js).
 *
 * GME numera le ore del giorno di mercato da 1: l'ora h e' la h-esima ora
 * fisica dalla mezzanotte italiana. Il giorno del passaggio all'ora solare
 * ha 25 ore, quello del passaggio all'ora legale 23: per questo l'istante si
 * ricava sommando ore alla mezzanotte, non componendo "hh:00+offset".
 */

const HOUR_MS = 3_600_000;

const ROME_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Offset di Roma rispetto a UTC (in ms) in un dato istante. */
function romeOffsetMs(instantMs: number): number {
  const p: Record<string, number> = {};
  for (const part of ROME_PARTS.formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** Istante UTC (ms) della mezzanotte italiana del giorno `isoDate` (YYYY-MM-DD). */
function romeMidnightMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const wallMidnight = Date.UTC(y, m - 1, d);
  // Prima stima con l'offset di quell'istante, poi correzione: a mezzanotte
  // non avviene mai un cambio d'ora in Italia, quindi converge in un passo.
  const guess = wallMidnight - romeOffsetMs(wallMidnight);
  return wallMidnight - romeOffsetMs(guess);
}

/** Ora GME `hour` (1..25) del giorno `isoDate` → istante ISO UTC di inizio ora. */
export function romeHourToIso(isoDate: string, hour: number): string {
  return new Date(romeMidnightMs(isoDate) + (hour - 1) * HOUR_MS).toISOString();
}

/** Inizio (incluso) e fine (esclusa) del giorno italiano `isoDate`, in ISO UTC. */
export function romeDayBoundsUtc(isoDate: string): { start: string; end: string } {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return {
    start: new Date(romeMidnightMs(isoDate)).toISOString(),
    end: new Date(romeMidnightMs(next)).toISOString(),
  };
}

/** Data italiana (YYYY-MM-DD) di un istante. */
export function romeDateOf(instant: string | Date | number): string {
  const ms =
    typeof instant === "number" ? instant : typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  return new Date(ms + romeOffsetMs(ms)).toISOString().slice(0, 10);
}

/** Ora GME (1..25) a cui appartiene l'istante: inverso di `romeHourToIso`. */
export function romeHourOf(instant: string | Date): number {
  const ms = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  return Math.floor((ms - romeMidnightMs(romeDateOf(ms))) / HOUR_MS) + 1;
}
