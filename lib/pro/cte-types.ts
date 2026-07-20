/**
 * CTE Builder — types per la generazione di Condizioni Tecnico Economiche
 * conformi ARERA per offerte mercato libero residenziali.
 *
 * Riferimenti normativi:
 *  - TIQE 2024 (Testo Integrato Qualità Elettrica, Del. 569/2019/R/com)
 *  - Codice di Condotta Commerciale (Del. 302/2016/R/com)
 *  - TIVG (Testo Integrato Vendita Gas, Del. ARG/gas 64/09)
 *  - TIV (Testo Integrato Vendita Elettrica, Del. 156/07 e s.m.i.)
 *  - Dal 1 luglio 2025: nuove Schede Sintetiche standardizzate ARERA
 *    (Del. 25/2025/R/com)
 *
 * Pure types, no I/O, no React.
 */

// ============================================================
// VENDITORE
// ============================================================

export interface Venditore {
  ragioneSociale: string;
  partitaIva: string;
  sedeLegale: string;
  cap: string;
  citta: string;
  provincia: string;
  numeroVerde: string;
  numeroCellulare?: string;
  emailContatto: string;
  sitoWeb: string;
  /** PEC opzionale */
  pec?: string;
  /** Codice REA */
  codiceRea?: string;
  /** Capitale sociale espresso in euro */
  capitaleSocialeEur?: number;
}

// ============================================================
// IDENTIFICAZIONE OFFERTA
// ============================================================

export type SegmentoCliente = "domestico" | "non_domestico";
export type TipologiaMercato = "libero" | "placet" | "tutela";

export interface Identificazione {
  nomeOfferta: string;
  /** Formato 16 char alfanumerici assegnato dal Portale Offerte ARERA */
  codiceOfferta: string;
  segmento: SegmentoCliente;
  tipologiaMercato: TipologiaMercato;
  /** Inizio validità ISO YYYY-MM-DD */
  validitaDal: string;
  /** Fine validità ISO YYYY-MM-DD */
  validitaAl: string;
  /** Durata contratto: "indeterminata" o numero mesi */
  durataContratto: "indeterminata" | number;
}

// ============================================================
// TIPOLOGIA E CORRISPETTIVI
// ============================================================

export type CommodityType = "elettrico" | "gas" | "dual";
export type StrutturaPrezzo = "fisso" | "variabile" | "misto";
export type TipoTariffa = "monoraria" | "multioraria_f1_f2_f3";

export interface CorrispettivoAnnuoStep {
  /** Mese iniziale (incluso, 1-based) */
  daMese: number;
  /** Mese finale (incluso) o null se "in avanti" */
  aMese: number | null;
  /** EUR/POD/anno o EUR/PdR/anno */
  valoreEur: number;
}

export interface Corrispettivi {
  /** Corrispettivo annuo a copertura costi commercializzazione,
   *  espresso come step (può variare nel tempo, es. 144 -> 126 -> 108) */
  corrispettivoAnnuoSteps: CorrispettivoAnnuoStep[];
  /** Spread aggiunto al prezzo wholesale, in €/kWh per luce o €/Smc per gas */
  spreadEurPerUnita: number;
  /** Per tariffe multiorarie, spread differenziato per fascia (default usa lo spread base) */
  spreadByFascia?: {
    f1: number;
    f2: number;
    f3: number;
  };
  /** Indice di riferimento: "PUN" per luce, "PSV" per gas, "fisso" per prezzo bloccato */
  indiceRiferimento: "PUN" | "PSV" | "fisso";
  /** Valore prezzo fisso (solo se indiceRiferimento = "fisso"), €/kWh o €/Smc */
  prezzoFissoEurPerUnita?: number;
  /** Periodicità aggiornamento indice */
  periodicitaIndice: "mensile" | "trimestrale" | "semestrale";
}

// ============================================================
// SERVIZI AGGIUNTIVI
// ============================================================

export interface ServiziAggiuntivi {
  /** Nome del servizio aggiuntivo (es. "Risolve", "MyEnergy CoCo") */
  nome: string;
  descrizione: string;
  /** Se è incluso senza costi aggiuntivi (true) o a pagamento (false) */
  incluso: boolean;
  /** Lista features (max 5 per leggibilità ARERA) */
  features: string[];
}

// ============================================================
// TERMINI CONTRATTUALI
// ============================================================

export type MetodoPagamento = "sdd" | "carta_credito" | "bollettino" | "rid";
export type FrequenzaFatturazione = "mensile" | "bimestrale" | "trimestrale";

export interface TerminiContrattuali {
  metodiPagamento: MetodoPagamento[];
  frequenzaFatturazione: FrequenzaFatturazione;
  /** Giorni dalla data emissione fattura entro cui pagare (di norma 30) */
  giorniPagamento: number;
  /** Garanzie/deposito cauzionale richiesto, eur per kW (0 se nessuna) */
  depositoEurPerKw: number;
  /** Durata condizioni economiche in mesi (es. 36 = blocco 3 anni) */
  durataCondizioniMesi: number;
  /** Mesi di preavviso per modifica condizioni (default 3 da norma ARERA) */
  preavvisoModificaMesi: number;
  /** Oneri di recesso anticipato (di norma "Nessuno") */
  oneriRecessoAnticipato: string;
}

// ============================================================
// OFFERTA COMPLETA
// ============================================================

export interface CTEOffer {
  venditore: Venditore;
  identificazione: Identificazione;
  commodity: CommodityType;
  strutturaPrezzo: StrutturaPrezzo;
  tipoTariffa: TipoTariffa;
  corrispettivi: Corrispettivi;
  servizi: ServiziAggiuntivi[];
  termini: TerminiContrattuali;
  /** Note testuali opzionali (es. "Energia 100% rinnovabile certificata GO") */
  noteSostenibilita?: string;
}

// ============================================================
// PROFILI TIPO STANDARD ARERA
// ============================================================

export interface ProfiloTipoElettrico {
  id: string;
  consumoAnnuoKwh: number;
  /** Potenza impegnata in kW */
  potenzaImpegnata: number;
  /** Tipologia abitazione */
  tipoAbitazione: "residenza" | "non_residenza";
  /** Label leggibile per visualizzazione */
  label: string;
}

export const PROFILI_TIPO_ELETTRICO: ProfiloTipoElettrico[] = [
  { id: "res-3kw-1500", consumoAnnuoKwh: 1500, potenzaImpegnata: 3, tipoAbitazione: "residenza", label: "Residenza · 3 kW · 1.500 kWh/anno" },
  { id: "res-3kw-2200", consumoAnnuoKwh: 2200, potenzaImpegnata: 3, tipoAbitazione: "residenza", label: "Residenza · 3 kW · 2.200 kWh/anno" },
  { id: "res-3kw-2700", consumoAnnuoKwh: 2700, potenzaImpegnata: 3, tipoAbitazione: "residenza", label: "Residenza · 3 kW · 2.700 kWh/anno" },
  { id: "res-3kw-3200", consumoAnnuoKwh: 3200, potenzaImpegnata: 3, tipoAbitazione: "residenza", label: "Residenza · 3 kW · 3.200 kWh/anno" },
  { id: "non-res-3kw-900", consumoAnnuoKwh: 900, potenzaImpegnata: 3, tipoAbitazione: "non_residenza", label: "Non residenza · 3 kW · 900 kWh/anno" },
  { id: "non-res-3kw-4000", consumoAnnuoKwh: 4000, potenzaImpegnata: 3, tipoAbitazione: "non_residenza", label: "Non residenza · 3 kW · 4.000 kWh/anno" },
  { id: "res-45kw-3500", consumoAnnuoKwh: 3500, potenzaImpegnata: 4.5, tipoAbitazione: "residenza", label: "Residenza · 4,5 kW · 3.500 kWh/anno" },
  { id: "res-6kw-6000", consumoAnnuoKwh: 6000, potenzaImpegnata: 6, tipoAbitazione: "residenza", label: "Residenza · 6 kW · 6.000 kWh/anno" },
];

// ============================================================
// VALIDATION
// ============================================================

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationCheck {
  id: string;
  section: string;
  severity: ValidationSeverity;
  message: string;
  /** True = check passato, false = check fallito */
  passed: boolean;
}

export interface ValidationResult {
  checks: ValidationCheck[];
  /** Conteggio per severity */
  summary: {
    total: number;
    passed: number;
    errors: number;
    warnings: number;
  };
  /** Score 0..100 di compliance (% di check passati) */
  complianceScore: number;
}

// ============================================================
// SPESA STIMATA (SCHEDA DI CONFRONTABILITÀ)
// ============================================================

export interface SpesaStimataRow {
  profilo: ProfiloTipoElettrico;
  /** Spesa annua offerta del venditore (€ escluse imposte) */
  spesaOffertaEur: number;
  /** Spesa annua Servizio di Maggior Tutela (€ escluse imposte) */
  spesaMaggiorTutelaEur: number;
  /** Differenza: positivo = offerta più cara, negativo = offerta più conveniente */
  delta: number;
  /** Variazione % della spesa rispetto alla MT */
  deltaPct: number;
}

export interface SchedaConfrontabilita {
  rows: SpesaStimataRow[];
  /** PUN forecast medio usato per il calcolo (€/MWh) */
  punForecastEurPerMwh: number;
  /** Data del calcolo */
  calculatedAt: string;
}
