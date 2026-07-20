/**
 * Backfill TTF: scarica 8 anni indietro dal Yahoo Finance (TTF=F).
 * Esecuzione manuale 1 sola volta dopo il primo deploy del nuovo asset.
 *   npx tsx scripts/backfill-ttf.ts
 */
import { TTFIngestor } from "./etl-ttf";

void (async () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 8);
  console.log(
    `Backfill TTF: ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`,
  );
  const result = await new TTFIngestor().run(start, end);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "success" ? 0 : 1);
})();
