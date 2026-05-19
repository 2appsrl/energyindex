/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { validateCTEOffer } from "@/lib/pro/cte-validation";
import type { CTEOffer } from "@/lib/pro/cte-types";

function makeValidOffer(overrides: Partial<CTEOffer> = {}): CTEOffer {
  return {
    venditore: {
      ragioneSociale: "Energia Verde S.p.A.",
      partitaIva: "12345678901",
      sedeLegale: "Via Roma 1",
      cap: "20121",
      citta: "Milano",
      provincia: "MI",
      numeroVerde: "800123456",
      emailContatto: "info@energiaverde.it",
      sitoWeb: "https://www.energiaverde.it",
    },
    identificazione: {
      nomeOfferta: "Energia Verde Variabile",
      codiceOfferta: "000123ESVML09XXLEESPX001X9XXXXX5",
      segmento: "domestico",
      tipologiaMercato: "libero",
      validitaDal: "2026-05-01",
      validitaAl: "2026-05-15",
      durataContratto: "indeterminata",
    },
    commodity: "elettrico",
    strutturaPrezzo: "variabile",
    tipoTariffa: "monoraria",
    corrispettivi: {
      corrispettivoAnnuoSteps: [
        { daMese: 1, aMese: 12, valoreEur: 120 },
        { daMese: 13, aMese: 24, valoreEur: 108 },
        { daMese: 25, aMese: null, valoreEur: 96 },
      ],
      spreadEurPerUnita: 0.022,
      indiceRiferimento: "PUN",
      periodicitaIndice: "mensile",
    },
    servizi: [
      {
        nome: "Assistenza Tecnica 24/7",
        descrizione: "Servizio incluso di prenotazione interventi tecnici in 4h.",
        incluso: true,
        features: ["Elettricista", "Idraulico", "Termoidraulico"],
      },
    ],
    termini: {
      metodiPagamento: ["sdd"],
      frequenzaFatturazione: "bimestrale",
      giorniPagamento: 30,
      depositoEurPerKw: 0,
      durataCondizioniMesi: 36,
      preavvisoModificaMesi: 3,
      oneriRecessoAnticipato: "Nessuno",
    },
    ...overrides,
  };
}

describe("validateCTEOffer", () => {
  it("offerta completa valida passa tutti i check critici", () => {
    const result = validateCTEOffer(makeValidOffer());
    expect(result.summary.errors).toBe(0);
    expect(result.complianceScore).toBeGreaterThan(80);
  });

  it("ritorna esattamente 23 check", () => {
    const result = validateCTEOffer(makeValidOffer());
    expect(result.checks).toHaveLength(23);
  });

  it("P.IVA non a 11 cifre genera errore", () => {
    const offer = makeValidOffer({
      venditore: { ...makeValidOffer().venditore, partitaIva: "12345" },
    });
    const result = validateCTEOffer(offer);
    const pivaCheck = result.checks.find((c) => c.id === "venditore.partita-iva");
    expect(pivaCheck?.passed).toBe(false);
    expect(pivaCheck?.severity).toBe("error");
  });

  it("numero verde formato non 800XXXXXXX genera errore", () => {
    const offer = makeValidOffer({
      venditore: { ...makeValidOffer().venditore, numeroVerde: "1234" },
    });
    const result = validateCTEOffer(offer);
    const check = result.checks.find((c) => c.id === "venditore.numero-verde");
    expect(check?.passed).toBe(false);
  });

  it("codice offerta troppo corto genera errore", () => {
    const offer = makeValidOffer({
      identificazione: {
        ...makeValidOffer().identificazione,
        codiceOfferta: "ABC123",
      },
    });
    const result = validateCTEOffer(offer);
    const check = result.checks.find((c) => c.id === "identificazione.codice-offerta");
    expect(check?.passed).toBe(false);
  });

  it("validità < 7 giorni genera warning", () => {
    const offer = makeValidOffer({
      identificazione: {
        ...makeValidOffer().identificazione,
        validitaDal: "2026-05-01",
        validitaAl: "2026-05-03",
      },
    });
    const result = validateCTEOffer(offer);
    const check = result.checks.find((c) => c.id === "identificazione.validita-min");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("warning");
  });

  it("preavviso modifica < 3 mesi genera errore (Del. 302/2016)", () => {
    const valid = makeValidOffer();
    const offer = makeValidOffer({
      termini: { ...valid.termini, preavvisoModificaMesi: 1 },
    });
    const result = validateCTEOffer(offer);
    const check = result.checks.find((c) => c.id === "termini.preavviso-modifica");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("error");
  });

  it("oneri di recesso != 'Nessuno' genera errore", () => {
    const valid = makeValidOffer();
    const offer = makeValidOffer({
      termini: { ...valid.termini, oneriRecessoAnticipato: "50 euro" },
    });
    const result = validateCTEOffer(offer);
    const check = result.checks.find((c) => c.id === "termini.recesso-senza-oneri");
    expect(check?.passed).toBe(false);
  });

  it("offerta variabile elettrica con indice != PUN genera warning", () => {
    const valid = makeValidOffer();
    const offer = makeValidOffer({
      corrispettivi: { ...valid.corrispettivi, indiceRiferimento: "PSV" },
    });
    const result = validateCTEOffer(offer);
    const check = result.checks.find((c) => c.id === "corrispettivi.indice-coerente-luce");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("warning");
  });

  it("nessun metodo pagamento genera errore", () => {
    const valid = makeValidOffer();
    const offer = makeValidOffer({
      termini: { ...valid.termini, metodiPagamento: [] },
    });
    const result = validateCTEOffer(offer);
    const check = result.checks.find((c) => c.id === "termini.metodi-pagamento");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("error");
  });

  it("spread negativo genera errore", () => {
    const valid = makeValidOffer();
    const offer = makeValidOffer({
      corrispettivi: { ...valid.corrispettivi, spreadEurPerUnita: -0.01 },
    });
    const result = validateCTEOffer(offer);
    const check = result.checks.find((c) => c.id === "corrispettivi.spread-negativo");
    expect(check?.passed).toBe(false);
  });

  it("compliance score in [0, 100]", () => {
    const result = validateCTEOffer(makeValidOffer());
    expect(result.complianceScore).toBeGreaterThanOrEqual(0);
    expect(result.complianceScore).toBeLessThanOrEqual(100);
  });

  it("summary conta correttamente errors + warnings + passed", () => {
    const result = validateCTEOffer(makeValidOffer());
    const { total, passed, errors, warnings } = result.summary;
    expect(passed + errors + warnings).toBeLessThanOrEqual(total);
    expect(total).toBe(result.checks.length);
  });
});
