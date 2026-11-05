/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { buildLatestPriceJson, dailyAverageFor } from "@/lib/api/price-json";

describe("buildLatestPriceJson — PSV", () => {
  // Riga reale: sessione 28/10, consegna giorno gas 29/10 (salvata come 00:00 CET).
  const psvRow = {
    observed_at: "2026-10-28T23:00:00+00:00",
    value: "105.578163",
    extra: { session_date: "2026-10-28" },
  };

  it("date e' il giorno gas, non la data UTC", () => {
    const j = buildLatestPriceJson("psv", psvRow, "€/MWh")!;
    expect(j.date).toBe("2026-10-29");
    expect(j.gas_day).toBe("2026-10-29");
  });

  it("espone sessione e codice prodotto MGP-GAS", () => {
    const j = buildLatestPriceJson("psv", psvRow, "€/MWh")!;
    expect(j.session_date).toBe("2026-10-28");
    expect(j.product).toBe("MGP-2026-10-29");
    expect(j.value_native).toBe(105.58);
  });

  it("senza session_date salvata la stima come giorno gas - 1", () => {
    const j = buildLatestPriceJson("psv", { ...psvRow, extra: null }, "€/MWh")!;
    expect(j.session_date).toBe("2026-10-28");
  });

  it("dichiara che il valore e' il prezzo di riferimento MGP-GAS", () => {
    const j = buildLatestPriceJson("psv", psvRow, "€/MWh")!;
    expect(j.asset_name).toMatch(/prezzo di riferimento MGP-GAS/i);
  });
});

describe("buildLatestPriceJson — PUN", () => {
  const lastHour = { observed_at: "2026-11-05T22:00:00+00:00", value: 255.30866 };
  const media = { date: "2026-11-05", value: 277.6412, hours: 24 };

  it("value e' la media del giorno: e' il dato che chi legge l'API si aspetta", () => {
    const j = buildLatestPriceJson("pun", lastHour, "€/MWh", media)!;
    expect(j.value).toBe(0.27764);
    expect(j.value_native).toBe(277.64);
    expect(j.date).toBe("2026-11-05");
    expect(j.granularity).toBe("daily");
  });

  it("observed_at e' l'inizio del giorno italiano della media", () => {
    const j = buildLatestPriceJson("pun", lastHour, "€/MWh", media)!;
    expect(j.observed_at).toBe("2026-11-04T23:00:00.000Z");
  });

  it("l'ultima ora pubblicata si sposta in last_hour", () => {
    const j = buildLatestPriceJson("pun", lastHour, "€/MWh", media)!;
    expect(j.last_hour).toEqual({
      date: "2026-11-05",
      hour: 24,
      observed_at: "2026-11-05T22:00:00+00:00",
      value: 0.25531,
      unit: "€/kWh",
      value_native: 255.31,
      unit_native: "€/MWh",
    });
    expect(j).not.toHaveProperty("hour");
  });

  it("daily_average resta per chi lo usa gia'", () => {
    const j = buildLatestPriceJson("pun", lastHour, "€/MWh", media)!;
    expect(j.daily_average).toEqual({
      date: "2026-11-05",
      value: 0.27764,
      unit: "€/kWh",
      value_native: 277.64,
      unit_native: "€/MWh",
      hours: 24,
    });
  });

  it("senza media disponibile value resta l'ora e lo dichiara", () => {
    const j = buildLatestPriceJson("pun", lastHour, "€/MWh", null)!;
    expect(j.value_native).toBe(255.31);
    expect(j.granularity).toBe("hourly");
    expect(j.date).toBe("2026-11-05");
    expect(j.daily_average).toBeNull();
    expect(j.last_hour?.hour).toBe(24);
  });
});

describe("buildLatestPriceJson — attribuzione e fonti", () => {
  it("i dati GME citano il GME e linkano le sue condizioni d'uso", () => {
    const j = buildLatestPriceJson("pun", { observed_at: "2026-10-30T10:00:00Z", value: 100 }, "€/MWh")!;
    expect(j.attribution).toContain("Gestore dei Mercati Energetici S.p.A.");
    expect(j.attribution).toContain("https://energyindex.it");
    expect(j.source_terms_url).toMatch(/^https:\/\/www\.mercatoelettrico\.org\//);
  });

  it("gli altri indici mantengono date UTC e nessun campo GME", () => {
    const j = buildLatestPriceJson("brent", { observed_at: "2026-10-29T00:00:00+00:00", value: 71.4 }, "$/bbl")!;
    expect(j.date).toBe("2026-10-29");
    expect(j.gas_day).toBeUndefined();
    expect(j.last_hour).toBeUndefined();
    expect(j.source_terms_url).toBeUndefined();
  });

  it("asset sconosciuto → null", () => {
    expect(buildLatestPriceJson("xyz", { observed_at: "2026-10-29T00:00:00Z", value: 1 }, "€")).toBeNull();
  });
});

describe("dailyAverageFor", () => {
  const rows = [
    { observed_at: "2026-10-29T23:00:00Z", value: 200 }, // 30/10 ora 1
    { observed_at: "2026-10-30T22:00:00Z", value: 300 }, // 30/10 ora 24
    { observed_at: "2026-10-30T23:00:00Z", value: 999 }, // 31/10 ora 1 (domani)
  ];

  it("usa il giorno italiano richiesto, ignorando le ore di domani", () => {
    expect(dailyAverageFor(rows, "2026-10-30")).toEqual({ date: "2026-10-30", value: 250, hours: 2 });
  });

  it("se oggi manca, ripiega sull'ultimo giorno precedente disponibile", () => {
    expect(dailyAverageFor(rows.slice(0, 2), "2026-11-02")).toEqual({ date: "2026-10-30", value: 250, hours: 2 });
  });

  it("nessuna riga → null", () => {
    expect(dailyAverageFor([], "2026-10-30")).toBeNull();
  });
});
