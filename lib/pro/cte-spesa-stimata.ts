/**
 * CTE Builder — calcolo Scheda di Confrontabilità.
 *
 * Dato una CTEOffer + PUN forecast medio, calcola la spesa annua stimata
 * (escluse imposte e tasse) per ognuno degli 8 profili tipo standard ARERA,
 * e la confronta con la spesa stimata del Servizio di Maggior Tutela.
 *
 * Approssimazione MT (Servizio Maggior Tutela):
 *  - Costo materia energia: PUN forecast medio + 0.02 EUR/kWh (overhead ARERA)
 *  - Quota fissa MT: ~108 EUR/anno (valore tipico TIV 2026)
 *  - Tariffa rete + oneri sistema: ~0.06 EUR/kWh (proxy semplificato)
 *
 * Questa approssimazione viene usata per il confronto orientativo; il valore
 * effettivo del Servizio di Maggior Tutela è pubblicato mensilmente da ARERA.
 *
 * Pure functions, no I/O, testabili.
 */

import type {
  CTEOffer,
  ProfiloTipoElettrico,
  SchedaConfrontabilita,
  SpesaStimataRow,
} from "./cte-types";
import { PROFILI_TIPO_ELETTRICO } from "./cte-types";

// ============================================================
// COSTANTI MT (Servizio Maggior Tutela) — proxy ARERA 2026
// ============================================================

/** Markup MT su PUN per coprire dispacciamento + commercializzazione */
const MT_MARKUP_EUR_PER_KWH = 0.02;
/** Quota fissa MT in EUR/anno per cliente con potenza standard */
const MT_QUOTA_FISSA_EUR_ANNO = 108;
/** Tariffa rete + oneri sistema (proxy semplificato) in EUR/kWh */
const MT_RETE_E_ONERI_EUR_PER_KWH = 0.06;

// ============================================================
// CALCOLI PER OFFERTA E PROFILO
// ============================================================

/**
 * Calcola il corrispettivo annuo per il primo anno di fornitura,
 * partendo dagli step definiti nell'offerta (es. 144 → 126 → 108).
 * Per il calcolo della Scheda Confrontabilità si usa il primo step
 * (primi 12 mesi) come da prassi ARERA.
 */
function corrispettivoAnnuoPrimoStep(offer: CTEOffer): number {
  if (offer.corrispettivi.corrispettivoAnnuoSteps.length === 0) return 0;
  return offer.corrispettivi.corrispettivoAnnuoSteps[0].valoreEur;
}

/**
 * Prezzo all-in per kWh nell'offerta del venditore, dato il PUN forecast medio.
 * Per offerta variabile: PUN + spread.
 * Per offerta fissa: prezzo fisso indicato.
 */
function prezzoOffertaEurPerKwh(offer: CTEOffer, punForecastEurPerMwh: number): number {
  const punEurKwh = punForecastEurPerMwh / 1000;
  if (offer.strutturaPrezzo === "fisso") {
    return offer.corrispettivi.prezzoFissoEurPerUnita ?? punEurKwh + 0.025;
  }
  return punEurKwh + offer.corrispettivi.spreadEurPerUnita;
}

/**
 * Spesa annua offerta per un singolo profilo tipo.
 * Include: corrispettivo annuo + (prezzo all-in × consumo kWh) +
 *          (tariffa rete + oneri sistema) × consumo kWh.
 * Esclude imposte e accise (come da formato ARERA).
 */
export function calcolaSpesaOfferta(
  offer: CTEOffer,
  profilo: ProfiloTipoElettrico,
  punForecastEurPerMwh: number,
): number {
  const annuoEur = corrispettivoAnnuoPrimoStep(offer);
  const prezzoConsumoEurKwh = prezzoOffertaEurPerKwh(offer, punForecastEurPerMwh);
  const consumoCosto = prezzoConsumoEurKwh * profilo.consumoAnnuoKwh;
  const reteEoneri = MT_RETE_E_ONERI_EUR_PER_KWH * profilo.consumoAnnuoKwh;
  return annuoEur + consumoCosto + reteEoneri;
}

/**
 * Spesa annua stimata Servizio Maggior Tutela per il profilo, calcolata
 * con il proxy PUN + markup + rete/oneri. Esclude imposte.
 */
export function calcolaSpesaMaggiorTutela(
  profilo: ProfiloTipoElettrico,
  punForecastEurPerMwh: number,
): number {
  const punEurKwh = punForecastEurPerMwh / 1000;
  const prezzoMT = punEurKwh + MT_MARKUP_EUR_PER_KWH;
  return (
    MT_QUOTA_FISSA_EUR_ANNO +
    prezzoMT * profilo.consumoAnnuoKwh +
    MT_RETE_E_ONERI_EUR_PER_KWH * profilo.consumoAnnuoKwh
  );
}

/**
 * Genera la Scheda di Confrontabilità completa con tutti gli 8 profili
 * tipo ARERA per offerte elettriche residenziali.
 */
export function generaSchedaConfrontabilita(
  offer: CTEOffer,
  punForecastEurPerMwh: number,
): SchedaConfrontabilita {
  const rows: SpesaStimataRow[] = PROFILI_TIPO_ELETTRICO.map((profilo) => {
    const spesaOffertaEur = calcolaSpesaOfferta(offer, profilo, punForecastEurPerMwh);
    const spesaMaggiorTutelaEur = calcolaSpesaMaggiorTutela(profilo, punForecastEurPerMwh);
    const delta = spesaOffertaEur - spesaMaggiorTutelaEur;
    const deltaPct = spesaMaggiorTutelaEur > 0 ? (delta / spesaMaggiorTutelaEur) * 100 : 0;
    return { profilo, spesaOffertaEur, spesaMaggiorTutelaEur, delta, deltaPct };
  });

  return {
    rows,
    punForecastEurPerMwh,
    calculatedAt: new Date().toISOString(),
  };
}
