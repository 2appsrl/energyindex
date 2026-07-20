/**
 * Backfill Brent: scarica 10 anni indietro dall'API EIA.
 * Esecuzione manuale 1 sola volta dopo il primo deploy.
 *   npx tsx scripts/backfill-brent.ts
 */
import { BrentIngestor } from "./etl-brent";

void (async () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 10);
  console.log(`Backfill Brent: ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`);
  const result = await new BrentIngestor().run(start, end);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "success" ? 0 : 1);
})();
