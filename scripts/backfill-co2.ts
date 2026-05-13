import { Co2Ingestor } from "./etl-co2";

void (async () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 5);
  console.log(`Backfill CO2: ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`);
  const result = await new Co2Ingestor().run(start, end);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "success" ? 0 : 1);
})();
