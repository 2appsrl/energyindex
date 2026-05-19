/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  calcolaSpesaOfferta,
  calcolaSpesaMaggiorTutela,
  generaSchedaConfrontabilita,
} from "@/lib/pro/cte-spesa-stimata";
import { PROFILI_TIPO_ELETTRICO } from "@/lib/pro/cte-types";
import type { CTEOffer } from "@/lib/pro/cte-types";

function offerVariabile(spreadEurPerKwh = 0.022, corrispettivoAnnuoEur = 144): CTEOffer {
  return {
    venditore: {
      ragioneSociale: "Test Energy",
      partitaIva: "12345678901",
      sedeLegale: "",
      cap: "",
      citta: "",
      provincia: "",
      numeroVerde: "800000000",
      emailContatto: "",
      sitoWeb: "",
    },
    identificazione: {
      nomeOfferta: "Test",
      codiceOfferta: "ABCDEFGHIJKLMNOP",
      segmento: "domestico",
      tipologiaMercato: "libero",
      validitaDal: "2026-01-01",
      validitaAl: "2026-12-31",
      durataContratto: "indeterminata",
    },
    commodity: "elettrico",
    strutturaPrezzo: "variabile",
    tipoTariffa: "monoraria",
    corrispettivi: {
      corrispettivoAnnuoSteps: [{ daMese: 1, aMese: null, valoreEur: corrispettivoAnnuoEur }],
      spreadEurPerUnita: spreadEurPerKwh,
      indiceRiferimento: "PUN",
      periodicitaIndice: "mensile",
    },
    servizi: [],
    termini: {
      metodiPagamento: ["sdd"],
      frequenzaFatturazione: "bimestrale",
      giorniPagamento: 30,
      depositoEurPerKw: 0,
      durataCondizioniMesi: 36,
      preavvisoModificaMesi: 3,
      oneriRecessoAnticipato: "Nessuno",
    },
  };
}

describe("calcolaSpesaOfferta", () => {
  it("spesa cresce monotonicamente con il consumo", () => {
    const offer = offerVariabile();
    const pun = 110; // €/MWh
    const piuPiccolo = PROFILI_TIPO_ELETTRICO[0]; // 1500 kWh
    const piuGrande = PROFILI_TIPO_ELETTRICO[7]; // 6000 kWh
    const sPiccolo = calcolaSpesaOfferta(offer, piuPiccolo, pun);
    const sGrande = calcolaSpesaOfferta(offer, piuGrande, pun);
    expect(sGrande).toBeGreaterThan(sPiccolo);
  });

  it("spread maggiore -> spesa offerta maggiore (a parità di profilo)", () => {
    const profilo = PROFILI_TIPO_ELETTRICO[3]; // 3200 kWh res
    const pun = 110;
    const s1 = calcolaSpesaOfferta(offerVariabile(0.02), profilo, pun);
    const s2 = calcolaSpesaOfferta(offerVariabile(0.05), profilo, pun);
    expect(s2).toBeGreaterThan(s1);
  });

  it("offerta fissa ignora il PUN e usa il prezzo fisso", () => {
    const profilo = PROFILI_TIPO_ELETTRICO[3];
    const offerFissa: CTEOffer = {
      ...offerVariabile(),
      strutturaPrezzo: "fisso",
      corrispettivi: {
        ...offerVariabile().corrispettivi,
        indiceRiferimento: "fisso",
        prezzoFissoEurPerUnita: 0.15,
      },
    };
    const sBassoPun = calcolaSpesaOfferta(offerFissa, profilo, 80);
    const sAltoPun = calcolaSpesaOfferta(offerFissa, profilo, 200);
    expect(sBassoPun).toBe(sAltoPun);
  });

  it("corrispettivo annuo maggiore -> spesa maggiore", () => {
    const profilo = PROFILI_TIPO_ELETTRICO[3];
    const s1 = calcolaSpesaOfferta(offerVariabile(0.022, 100), profilo, 110);
    const s2 = calcolaSpesaOfferta(offerVariabile(0.022, 200), profilo, 110);
    expect(s2 - s1).toBeCloseTo(100, 2);
  });
});

describe("calcolaSpesaMaggiorTutela", () => {
  it("MT cresce con consumo", () => {
    const piuPiccolo = PROFILI_TIPO_ELETTRICO[0]; // 1500 kWh
    const piuGrande = PROFILI_TIPO_ELETTRICO[7]; // 6000 kWh
    expect(calcolaSpesaMaggiorTutela(piuGrande, 110)).toBeGreaterThan(
      calcolaSpesaMaggiorTutela(piuPiccolo, 110),
    );
  });

  it("MT con PUN alto > MT con PUN basso (variabile)", () => {
    const profilo = PROFILI_TIPO_ELETTRICO[3];
    expect(calcolaSpesaMaggiorTutela(profilo, 200)).toBeGreaterThan(
      calcolaSpesaMaggiorTutela(profilo, 80),
    );
  });

  it("MT include quota fissa annua > 100 EUR (proxy 2026)", () => {
    const profilo = PROFILI_TIPO_ELETTRICO[4]; // 900 kWh
    expect(calcolaSpesaMaggiorTutela(profilo, 110)).toBeGreaterThan(100);
  });
});

describe("generaSchedaConfrontabilita", () => {
  it("ritorna esattamente 8 righe (profili tipo ARERA)", () => {
    const result = generaSchedaConfrontabilita(offerVariabile(), 110);
    expect(result.rows).toHaveLength(8);
  });

  it("ogni riga ha delta e deltaPct calcolati", () => {
    const result = generaSchedaConfrontabilita(offerVariabile(), 110);
    for (const row of result.rows) {
      expect(row.delta).toBeCloseTo(row.spesaOffertaEur - row.spesaMaggiorTutelaEur, 5);
      expect(Number.isFinite(row.deltaPct)).toBe(true);
    }
  });

  it("offerta più conveniente di MT -> delta negativo", () => {
    // Offerta con spread negligibile + corrispettivo annuo basso
    const offerConveniente = offerVariabile(0.001, 50);
    const result = generaSchedaConfrontabilita(offerConveniente, 110);
    const profiloGrande = result.rows.find((r) => r.profilo.consumoAnnuoKwh === 6000);
    expect(profiloGrande?.delta).toBeLessThan(0);
  });

  it("offerta più cara di MT -> delta positivo (caso tipico mercato libero)", () => {
    const offerCara = offerVariabile(0.05, 250);
    const result = generaSchedaConfrontabilita(offerCara, 110);
    const profiloGrande = result.rows.find((r) => r.profilo.consumoAnnuoKwh === 6000);
    expect(profiloGrande?.delta).toBeGreaterThan(0);
  });

  it("calculatedAt è una data ISO valida", () => {
    const result = generaSchedaConfrontabilita(offerVariabile(), 110);
    const d = new Date(result.calculatedAt);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });

  it("PUN forecast = 0 non genera NaN o Infinity", () => {
    const result = generaSchedaConfrontabilita(offerVariabile(), 0);
    for (const row of result.rows) {
      expect(Number.isFinite(row.spesaOffertaEur)).toBe(true);
      expect(Number.isFinite(row.spesaMaggiorTutelaEur)).toBe(true);
      expect(Number.isFinite(row.deltaPct)).toBe(true);
    }
  });
});
