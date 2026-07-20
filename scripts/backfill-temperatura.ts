/**
 * Backfill Temperatura 5 anni con chunking annuale.
 * Open-Meteo archive accetta range estesi ma chunking riduce risposta JSON
 * a dimensioni gestibili e da' miglior progress feedback.
 */
import { TemperaturaIngestor } from "./etl-temperatura";

void (async () => {
  const ing = new TemperaturaIngestor();
  const today = new Date();
  for (let yearsAgo = 5; yearsAgo >= 1; yearsAgo--) {
    const start = new Date(today);
    start.setUTCFullYear(start.getUTCFullYear() - yearsAgo);
    const end = new Date(today);
    end.setUTCFullYear(end.getUTCFullYear() - yearsAgo + 1);
    if (end > today) end.setTime(today.getTime());
    console.log(`Chunk ${yearsAgo}y: ${start.toISOString().slice(0,10)} → ${end.toISOString().slice(0,10)}`);
    const r = await ing.run(start, end);
    console.log(JSON.stringify(r, null, 2));
    if (r.status === "error") process.exit(1);
  }
})();
