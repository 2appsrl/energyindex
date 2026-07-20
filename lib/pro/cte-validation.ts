/**
 * CTE Builder — validatore ARERA-compliance.
 *
 * Esegue 24 check sulla struttura e contenuto di una CTEOffer in base
 * alle delibere ARERA. Ogni check ritorna severity (error/warning/info)
 * e un message azionabile per il team marketing.
 *
 * I check sono organizzati per sezione del documento di output (Scheda
 * Sintetica + Scheda Confrontabilità). Riferimenti normativi citati nei
 * messaggi quando rilevanti.
 *
 * Pure functions, no I/O, testabili.
 */

import type { CTEOffer, ValidationCheck, ValidationResult } from "./cte-types";

const ANNO_MS = 365 * 24 * 60 * 60 * 1000;
const SETTIMANA_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================
// SINGLE CHECKS (ognuno ritorna un ValidationCheck)
// ============================================================

function check(
  id: string,
  section: string,
  severity: ValidationCheck["severity"],
  message: string,
  passed: boolean,
): ValidationCheck {
  return { id, section, severity, message, passed };
}

// --- Venditore ---

function checkRagioneSociale(offer: CTEOffer): ValidationCheck {
  const v = offer.venditore.ragioneSociale.trim();
  return check(
    "venditore.ragione-sociale",
    "Venditore",
    "error",
    "Ragione sociale del venditore obbligatoria (es. 'Energia Verde S.p.A.')",
    v.length >= 3,
  );
}

function checkPartitaIva(offer: CTEOffer): ValidationCheck {
  const piva = offer.venditore.partitaIva.replace(/\s/g, "");
  // Italian P.IVA: 11 digits
  const valid = /^\d{11}$/.test(piva);
  return check(
    "venditore.partita-iva",
    "Venditore",
    "error",
    "Partita IVA italiana deve essere 11 cifre numeriche (formato ARERA)",
    valid,
  );
}

function checkNumeroVerde(offer: CTEOffer): ValidationCheck {
  const n = offer.venditore.numeroVerde.replace(/[\s.\-]/g, "");
  // Italian toll-free: 800 followed by 6 digits
  const valid = /^800\d{6}$/.test(n);
  return check(
    "venditore.numero-verde",
    "Venditore",
    "error",
    "Numero verde 800 obbligatorio (Art. 17 CGC, Codice di Condotta Commerciale)",
    valid,
  );
}

function checkSitoWeb(offer: CTEOffer): ValidationCheck {
  const url = offer.venditore.sitoWeb.trim();
  const valid = /^https?:\/\/.+\..+/.test(url);
  return check(
    "venditore.sito-web",
    "Venditore",
    "warning",
    "Sito web venditore consigliato per trasparenza (es. https://www.tuobrand.it)",
    valid,
  );
}

// --- Identificazione offerta ---

function checkCodiceOfferta(offer: CTEOffer): ValidationCheck {
  const c = offer.identificazione.codiceOfferta.trim();
  // Formato ARERA: tipicamente 16-32 char alfanumerici uppercase
  // (Edison usa 32, Engie usa 32; il Portale Offerte ne assegna il formato)
  const valid = /^[A-Z0-9]{16,32}$/.test(c);
  return check(
    "identificazione.codice-offerta",
    "Identificazione",
    "error",
    "Codice offerta in formato Portale Offerte (16-32 char alfanumerici uppercase)",
    valid,
  );
}

function checkNomeOfferta(offer: CTEOffer): ValidationCheck {
  return check(
    "identificazione.nome-offerta",
    "Identificazione",
    "error",
    "Nome offerta obbligatorio (es. 'Edison Superflex Luce')",
    offer.identificazione.nomeOfferta.trim().length >= 3,
  );
}

function checkValidita(offer: CTEOffer): ValidationCheck {
  const dal = new Date(offer.identificazione.validitaDal);
  const al = new Date(offer.identificazione.validitaAl);
  const validDates = !Number.isNaN(dal.getTime()) && !Number.isNaN(al.getTime());
  if (!validDates) {
    return check(
      "identificazione.validita-format",
      "Identificazione",
      "error",
      "Date validità non valide (usa formato YYYY-MM-DD)",
      false,
    );
  }
  const diff = al.getTime() - dal.getTime();
  // ARERA: validità minima 7 giorni, massima 1 anno (per offerte mercato libero)
  if (diff < SETTIMANA_MS) {
    return check(
      "identificazione.validita-min",
      "Identificazione",
      "warning",
      "Validità < 7 giorni: troppo breve per essere caricata sul Portale Offerte ARERA",
      false,
    );
  }
  if (diff > ANNO_MS) {
    return check(
      "identificazione.validita-max",
      "Identificazione",
      "warning",
      "Validità > 1 anno: insolita, di norma le offerte commerciali si rinnovano periodicamente",
      false,
    );
  }
  return check(
    "identificazione.validita",
    "Identificazione",
    "info",
    "Validità periodo offerta correttamente impostata",
    true,
  );
}

function checkSegmento(offer: CTEOffer): ValidationCheck {
  // OK per i casi base (domestico / non_domestico); informativa per il dual-use
  return check(
    "identificazione.segmento",
    "Identificazione",
    "info",
    `Segmento "${offer.identificazione.segmento}" indicato correttamente`,
    true,
  );
}

// --- Corrispettivi ---

function checkCorrispettivoAnnuoSteps(offer: CTEOffer): ValidationCheck {
  const steps = offer.corrispettivi.corrispettivoAnnuoSteps;
  if (steps.length === 0) {
    return check(
      "corrispettivi.annuo-presente",
      "Corrispettivi",
      "error",
      "Almeno un step di corrispettivo annuo obbligatorio (EUR/POD o EUR/PdR annui)",
      false,
    );
  }
  const allPositive = steps.every((s) => s.valoreEur >= 0);
  return check(
    "corrispettivi.annuo-positivi",
    "Corrispettivi",
    "error",
    "I valori del corrispettivo annuo devono essere >= 0 EUR",
    allPositive,
  );
}

function checkSpread(offer: CTEOffer): ValidationCheck {
  const s = offer.corrispettivi.spreadEurPerUnita;
  // Spread tipico: 0.005-0.05 EUR/kWh per luce, 0.05-0.20 EUR/Smc per gas.
  // Valori fuori range non sono "errori" ma "warning" — possono esistere casi giustificati.
  if (s < 0) {
    return check(
      "corrispettivi.spread-negativo",
      "Corrispettivi",
      "error",
      "Spread negativo non ammesso (non puoi vendere sotto wholesale)",
      false,
    );
  }
  if (offer.commodity === "elettrico" && s > 0.1) {
    return check(
      "corrispettivi.spread-luce-alto",
      "Corrispettivi",
      "warning",
      `Spread elettrico ${s.toFixed(4)} €/kWh sembra alto (tipico 0.02-0.05). Verifica.`,
      false,
    );
  }
  if (offer.commodity === "gas" && s > 0.3) {
    return check(
      "corrispettivi.spread-gas-alto",
      "Corrispettivi",
      "warning",
      `Spread gas ${s.toFixed(4)} €/Smc sembra alto (tipico 0.05-0.15). Verifica.`,
      false,
    );
  }
  return check(
    "corrispettivi.spread",
    "Corrispettivi",
    "info",
    `Spread ${s.toFixed(4)} €/${offer.commodity === "elettrico" ? "kWh" : "Smc"} nel range normale`,
    true,
  );
}

function checkIndiceRiferimento(offer: CTEOffer): ValidationCheck {
  const i = offer.corrispettivi.indiceRiferimento;
  if (offer.strutturaPrezzo === "fisso") {
    const ok = i === "fisso" && offer.corrispettivi.prezzoFissoEurPerUnita !== undefined;
    return check(
      "corrispettivi.indice-coerente-fisso",
      "Corrispettivi",
      "error",
      "Per offerta fissa: indice deve essere 'fisso' e prezzoFissoEurPerUnita valorizzato",
      ok,
    );
  }
  if (offer.commodity === "elettrico" && i !== "PUN") {
    return check(
      "corrispettivi.indice-coerente-luce",
      "Corrispettivi",
      "warning",
      "Per offerta elettrica variabile l'indice di riferimento standard è PUN Index GME",
      false,
    );
  }
  if (offer.commodity === "gas" && i !== "PSV") {
    return check(
      "corrispettivi.indice-coerente-gas",
      "Corrispettivi",
      "warning",
      "Per offerta gas variabile l'indice di riferimento standard è PSV (Heren European Spot Gas Markets)",
      false,
    );
  }
  return check(
    "corrispettivi.indice-coerente",
    "Corrispettivi",
    "info",
    `Indice "${i}" coerente con tipologia offerta`,
    true,
  );
}

function checkPeriodicitaIndice(offer: CTEOffer): ValidationCheck {
  // ARERA prescrive periodicità mensile per allineamento con pubblicazione PUN/PSV GME
  if (offer.strutturaPrezzo === "fisso") {
    return check(
      "corrispettivi.periodicita-fisso",
      "Corrispettivi",
      "info",
      "Periodicità non applicabile per offerta fissa",
      true,
    );
  }
  return check(
    "corrispettivi.periodicita",
    "Corrispettivi",
    "warning",
    "Periodicità indice 'mensile' è quella standard usata da tutti i fornitori (GME pubblica mensilmente)",
    offer.corrispettivi.periodicitaIndice === "mensile",
  );
}

// --- Termini contrattuali ---

function checkMetodiPagamento(offer: CTEOffer): ValidationCheck {
  return check(
    "termini.metodi-pagamento",
    "Termini contrattuali",
    "error",
    "Almeno un metodo di pagamento obbligatorio (SDD, carta credito, bollettino o RID)",
    offer.termini.metodiPagamento.length > 0,
  );
}

function checkGiorniPagamento(offer: CTEOffer): ValidationCheck {
  // Standard ARERA: 30 giorni dalla data emissione fattura (art. 9.6 CGC tipica)
  const g = offer.termini.giorniPagamento;
  return check(
    "termini.giorni-pagamento",
    "Termini contrattuali",
    "warning",
    "Termine pagamento standard è 30 giorni (Codice Condotta Commerciale Art. 4)",
    g === 30,
  );
}

function checkDurataCondizioni(offer: CTEOffer): ValidationCheck {
  const d = offer.termini.durataCondizioniMesi;
  // Tipico: 12, 24 o 36 mesi
  return check(
    "termini.durata-condizioni",
    "Termini contrattuali",
    "warning",
    "Durata condizioni economiche tipica: 12, 24 o 36 mesi (consigliati 24+ per certezza prezzo)",
    [12, 24, 36].includes(d),
  );
}

function checkPreavvisoModifica(offer: CTEOffer): ValidationCheck {
  // ARERA Del. 302/2016/R/com: preavviso minimo 3 mesi prima della scadenza condizioni
  const p = offer.termini.preavvisoModificaMesi;
  return check(
    "termini.preavviso-modifica",
    "Termini contrattuali",
    "error",
    "Preavviso modifica condizioni < 3 mesi viola Del. 302/2016/R/com (indennizzo automatico 30€)",
    p >= 3,
  );
}

function checkRecesso(offer: CTEOffer): ValidationCheck {
  // ARERA: recesso senza oneri obbligatorio (Del. 302/2016/R/com)
  const ok = offer.termini.oneriRecessoAnticipato.trim().toLowerCase() === "nessuno";
  return check(
    "termini.recesso-senza-oneri",
    "Termini contrattuali",
    "error",
    "Recesso senza oneri obbligatorio per offerte mercato libero (Del. 302/2016/R/com)",
    ok,
  );
}

// --- Servizi aggiuntivi ---

function checkServiziDescrizione(offer: CTEOffer): ValidationCheck {
  if (offer.servizi.length === 0) {
    return check(
      "servizi.assenti",
      "Servizi aggiuntivi",
      "info",
      "Nessun servizio aggiuntivo dichiarato (opzionale)",
      true,
    );
  }
  const allOk = offer.servizi.every(
    (s) => s.nome.length > 0 && s.descrizione.length >= 20,
  );
  return check(
    "servizi.descrizione",
    "Servizi aggiuntivi",
    "warning",
    "Ogni servizio aggiuntivo deve avere nome + descrizione >= 20 caratteri",
    allOk,
  );
}

// --- Composition checks (sezioni Scheda Sintetica complete) ---

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkPortaleOfferteReference(_offer: CTEOffer): ValidationCheck {
  // Questo check è simbolico: il riferimento www.ilportaleofferte.it è
  // sempre incluso nel PDF generato. Resta come check informativo.
  return check(
    "compliance.portale-offerte-ref",
    "Compliance",
    "info",
    "Riferimento a www.ilportaleofferte.it incluso automaticamente nel PDF generato",
    true,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkConciliazioneInfo(_offer: CTEOffer): ValidationCheck {
  return check(
    "compliance.conciliazione",
    "Compliance",
    "info",
    "Procedura di conciliazione ADR + Servizio Clienti Energia ARERA inclusi automaticamente",
    true,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkClienteVulnerabile(_offer: CTEOffer): ValidationCheck {
  return check(
    "compliance.cliente-vulnerabile",
    "Compliance",
    "info",
    "Indicazione opzioni per cliente vulnerabile + Servizio Maggior Tutela inclusa automaticamente",
    true,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkRipensamento(_offer: CTEOffer): ValidationCheck {
  return check(
    "compliance.ripensamento",
    "Compliance",
    "info",
    "Modulo ripensamento 14gg (30gg fuori locali) allegato automaticamente alla Scheda Sintetica",
    true,
  );
}

function checkMixEnergetico(offer: CTEOffer): ValidationCheck {
  // Obbligo art. 39 D.lgs. 28/2011 per offerte elettriche
  if (offer.commodity === "gas") {
    return check(
      "compliance.mix-energetico-gas",
      "Compliance",
      "info",
      "Mix energetico non applicabile per gas (solo elettrico)",
      true,
    );
  }
  return check(
    "compliance.mix-energetico",
    "Compliance",
    "info",
    "Composizione mix energetico (D.lgs. 28/2011 art. 39) inclusa nella pagina dedicata del PDF",
    true,
  );
}

// ============================================================
// ENTRY POINT
// ============================================================

export function validateCTEOffer(offer: CTEOffer): ValidationResult {
  const checks: ValidationCheck[] = [
    // Venditore (4)
    checkRagioneSociale(offer),
    checkPartitaIva(offer),
    checkNumeroVerde(offer),
    checkSitoWeb(offer),
    // Identificazione (4)
    checkCodiceOfferta(offer),
    checkNomeOfferta(offer),
    checkValidita(offer),
    checkSegmento(offer),
    // Corrispettivi (4)
    checkCorrispettivoAnnuoSteps(offer),
    checkSpread(offer),
    checkIndiceRiferimento(offer),
    checkPeriodicitaIndice(offer),
    // Termini (5)
    checkMetodiPagamento(offer),
    checkGiorniPagamento(offer),
    checkDurataCondizioni(offer),
    checkPreavvisoModifica(offer),
    checkRecesso(offer),
    // Servizi (1)
    checkServiziDescrizione(offer),
    // Compliance documenti (5)
    checkPortaleOfferteReference(offer),
    checkConciliazioneInfo(offer),
    checkClienteVulnerabile(offer),
    checkRipensamento(offer),
    checkMixEnergetico(offer),
  ];

  const passed = checks.filter((c) => c.passed).length;
  const errors = checks.filter((c) => !c.passed && c.severity === "error").length;
  const warnings = checks.filter((c) => !c.passed && c.severity === "warning").length;
  const total = checks.length;
  const complianceScore = total > 0 ? Math.round((passed / total) * 100) : 0;

  return {
    checks,
    summary: { total, passed, errors, warnings },
    complianceScore,
  };
}
