"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FileCheck2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Info,
  XCircle,
} from "lucide-react";
import { DemoLockBanner } from "./DemoLockBanner";
import { validateCTEOffer } from "@/lib/pro/cte-validation";
import { generaSchedaConfrontabilita } from "@/lib/pro/cte-spesa-stimata";
import type { CTEOffer, ValidationCheck } from "@/lib/pro/cte-types";

const EUR2 = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

// Default offer used as starting point in the wizard
const DEFAULT_OFFER: CTEOffer = {
  venditore: {
    ragioneSociale: "La Tua Azienda Energy S.r.l.",
    partitaIva: "12345678901",
    sedeLegale: "Via Roma 1",
    cap: "20121",
    citta: "Milano",
    provincia: "MI",
    numeroVerde: "800123456",
    emailContatto: "info@tuoazienda.it",
    sitoWeb: "https://www.tuoazienda.it",
  },
  identificazione: {
    nomeOfferta: "Energia Trasparente",
    codiceOfferta: "000123ESVML09XXLEESPX001X9XXXXX5",
    segmento: "domestico",
    tipologiaMercato: "libero",
    validitaDal: new Date().toISOString().slice(0, 10),
    validitaAl: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    durataContratto: "indeterminata",
  },
  commodity: "elettrico",
  strutturaPrezzo: "variabile",
  tipoTariffa: "monoraria",
  corrispettivi: {
    corrispettivoAnnuoSteps: [{ daMese: 1, aMese: null, valoreEur: 144 }],
    spreadEurPerUnita: 0.022,
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

export interface CTEBuilderViewProps {
  /** PUN forecast medio dal server (€/MWh) per il calcolo Scheda Confrontabilità */
  punForecastEurPerMwh: number;
}

const STEPS = [
  "Venditore",
  "Identificazione",
  "Tipologia",
  "Corrispettivi",
  "Servizi",
  "Termini",
  "Validazione",
  "Anteprima & Stampa",
] as const;

export function CTEBuilderView({ punForecastEurPerMwh }: CTEBuilderViewProps) {
  const [offer, setOffer] = useState<CTEOffer>(DEFAULT_OFFER);
  const [stepIdx, setStepIdx] = useState(0);

  const validation = useMemo(() => validateCTEOffer(offer), [offer]);
  const scheda = useMemo(
    () => generaSchedaConfrontabilita(offer, punForecastEurPerMwh),
    [offer, punForecastEurPerMwh],
  );

  function update<K extends keyof CTEOffer>(key: K, value: CTEOffer[K]) {
    setOffer((prev) => ({ ...prev, [key]: value }));
  }

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  return (
    <div className="space-y-4">
      <DemoLockBanner
        icon={FileCheck2}
        title="Demo: 1 template (Luce variabile domestico), Scheda Sintetica base, watermark DEMO sul PDF."
        description="Tier Enterprise 3.500€/mese: Gas + Dual fuel, multi-template, branding white-label, Scheda Confrontabilità auto, Mix energetico, submission Portale Offerte ARERA, salva offerte, library template Edison/Engie/Acea."
        ctaLabel="Sblocca Enterprise"
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr_320px]">
        {/* STEP NAVIGATION */}
        <nav aria-label="Wizard steps" className="bg-white rounded-xl border border-stone-200 p-4 h-fit print:hidden">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">
            Wizard CTE
          </h2>
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const isActive = i === stepIdx;
              const isDone = i < stepIdx;
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setStepIdx(i)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                      isActive
                        ? "bg-sky-600 text-white font-bold"
                        : isDone
                          ? "text-stone-700 hover:bg-stone-50"
                          : "text-stone-500 hover:bg-stone-50"
                    }`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-white text-sky-700"
                          : isDone
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {isDone ? "✓" : i + 1}
                    </span>
                    {s}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* STEP CONTENT */}
        <div className="space-y-4 min-w-0 print:hidden">
          {stepIdx === 0 && <StepVenditore offer={offer} update={update} />}
          {stepIdx === 1 && <StepIdentificazione offer={offer} update={update} />}
          {stepIdx === 2 && <StepTipologia offer={offer} update={update} />}
          {stepIdx === 3 && <StepCorrispettivi offer={offer} update={update} />}
          {stepIdx === 4 && <StepServizi offer={offer} update={update} />}
          {stepIdx === 5 && <StepTermini offer={offer} update={update} />}
          {stepIdx === 6 && <StepValidazione validation={validation} />}
          {stepIdx === 7 && (
            <StepAnteprima
              offer={offer}
              scheda={scheda}
              validation={validation}
              onPrint={handlePrint}
            />
          )}

          <div className="flex items-center justify-between pt-4 border-t border-stone-200">
            <button
              type="button"
              disabled={stepIdx === 0}
              onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
              className="px-4 py-2 rounded-md border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Indietro
            </button>
            <span className="text-xs text-stone-500">
              Step {stepIdx + 1} / {STEPS.length}
            </span>
            <button
              type="button"
              disabled={stepIdx === STEPS.length - 1}
              onClick={() => setStepIdx((s) => Math.min(STEPS.length - 1, s + 1))}
              className="px-4 py-2 rounded-md bg-sky-600 text-white text-sm font-semibold hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Avanti →
            </button>
          </div>
        </div>

        {/* VALIDATION SIDEBAR */}
        <aside className="bg-white rounded-xl border border-stone-200 p-4 h-fit print:hidden">
          <ValidationSummary validation={validation} />
        </aside>
      </div>

      {/* PRINT PREVIEW (only visible when printing) */}
      <div className="hidden print:block">
        <CTEPrintPreview
          offer={offer}
          scheda={scheda}
          punForecastEurPerMwh={punForecastEurPerMwh}
        />
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .container { padding: 0 !important; max-width: 100% !important; }
          @page { margin: 1cm; size: A4; }
          body::before {
            content: "DEMO";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 200px;
            font-weight: 900;
            color: rgba(220, 38, 38, 0.15);
            letter-spacing: 0.15em;
            pointer-events: none;
            z-index: 9999;
            font-family: system-ui, sans-serif;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// STEPS
// ============================================================

interface StepProps {
  offer: CTEOffer;
  update: <K extends keyof CTEOffer>(key: K, value: CTEOffer[K]) => void;
}

function StepVenditore({ offer, update }: StepProps) {
  const v = offer.venditore;
  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <h2 className="font-semibold text-stone-900">Dati venditore</h2>
      <p className="text-xs text-stone-600">
        Identificazione della società venditrice — obbligatoria per Scheda Sintetica ARERA.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldText
          label="Ragione sociale"
          value={v.ragioneSociale}
          onChange={(val) => update("venditore", { ...v, ragioneSociale: val })}
        />
        <FieldText
          label="Partita IVA (11 cifre)"
          value={v.partitaIva}
          onChange={(val) => update("venditore", { ...v, partitaIva: val })}
        />
        <FieldText
          label="Sede legale"
          value={v.sedeLegale}
          onChange={(val) => update("venditore", { ...v, sedeLegale: val })}
        />
        <FieldText
          label="CAP"
          value={v.cap}
          onChange={(val) => update("venditore", { ...v, cap: val })}
        />
        <FieldText
          label="Città"
          value={v.citta}
          onChange={(val) => update("venditore", { ...v, citta: val })}
        />
        <FieldText
          label="Provincia"
          value={v.provincia}
          onChange={(val) => update("venditore", { ...v, provincia: val })}
        />
        <FieldText
          label="Numero verde (800XXXXXXX)"
          value={v.numeroVerde}
          onChange={(val) => update("venditore", { ...v, numeroVerde: val })}
        />
        <FieldText
          label="Email contatto"
          value={v.emailContatto}
          onChange={(val) => update("venditore", { ...v, emailContatto: val })}
        />
        <FieldText
          label="Sito web (https://...)"
          value={v.sitoWeb}
          onChange={(val) => update("venditore", { ...v, sitoWeb: val })}
        />
      </div>
    </section>
  );
}

function StepIdentificazione({ offer, update }: StepProps) {
  const i = offer.identificazione;
  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <h2 className="font-semibold text-stone-900">Identificazione offerta</h2>
      <p className="text-xs text-stone-600">
        Codice e validità — il codice offerta è quello assegnato dal Portale Offerte ARERA al
        momento dell&apos;upload.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldText
          label="Nome offerta"
          value={i.nomeOfferta}
          onChange={(val) => update("identificazione", { ...i, nomeOfferta: val })}
        />
        <FieldText
          label="Codice offerta (16-32 char alfanumerici)"
          value={i.codiceOfferta}
          onChange={(val) =>
            update("identificazione", { ...i, codiceOfferta: val.toUpperCase() })
          }
        />
        <FieldSelect
          label="Segmento cliente"
          value={i.segmento}
          options={[
            { value: "domestico", label: "Domestico" },
            { value: "non_domestico", label: "Non domestico (PMI, business)" },
          ]}
          onChange={(val) =>
            update("identificazione", {
              ...i,
              segmento: val as typeof i.segmento,
            })
          }
        />
        <FieldSelect
          label="Tipologia mercato"
          value={i.tipologiaMercato}
          options={[
            { value: "libero", label: "Mercato Libero" },
            { value: "placet", label: "PLACET" },
          ]}
          onChange={(val) =>
            update("identificazione", {
              ...i,
              tipologiaMercato: val as typeof i.tipologiaMercato,
            })
          }
        />
        <FieldDate
          label="Validità dal"
          value={i.validitaDal}
          onChange={(val) => update("identificazione", { ...i, validitaDal: val })}
        />
        <FieldDate
          label="Validità al"
          value={i.validitaAl}
          onChange={(val) => update("identificazione", { ...i, validitaAl: val })}
        />
      </div>
    </section>
  );
}

function StepTipologia({ offer, update }: StepProps) {
  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <h2 className="font-semibold text-stone-900">Tipologia offerta</h2>
      <p className="text-xs text-stone-600">
        Demo limitata a Luce variabile monoraria. Gas + Dual + Fisso disponibili con tier
        Enterprise.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldSelect
          label="Commodity"
          value={offer.commodity}
          options={[
            { value: "elettrico", label: "Elettrico" },
            { value: "gas", label: "Gas naturale (Enterprise)", disabled: true },
            { value: "dual", label: "Dual fuel (Enterprise)", disabled: true },
          ]}
          onChange={(val) => update("commodity", val as CTEOffer["commodity"])}
        />
        <FieldSelect
          label="Struttura prezzo"
          value={offer.strutturaPrezzo}
          options={[
            { value: "variabile", label: "Variabile (indicizzato PUN/PSV)" },
            { value: "fisso", label: "Fisso (Enterprise)", disabled: true },
            { value: "misto", label: "Misto (Enterprise)", disabled: true },
          ]}
          onChange={(val) =>
            update("strutturaPrezzo", val as CTEOffer["strutturaPrezzo"])
          }
        />
        <FieldSelect
          label="Tipo tariffa"
          value={offer.tipoTariffa}
          options={[
            { value: "monoraria", label: "Monoraria (F0)" },
            {
              value: "multioraria_f1_f2_f3",
              label: "Multioraria F1/F2/F3 (Enterprise)",
              disabled: true,
            },
          ]}
          onChange={(val) => update("tipoTariffa", val as CTEOffer["tipoTariffa"])}
        />
      </div>
    </section>
  );
}

function StepCorrispettivi({ offer, update }: StepProps) {
  const c = offer.corrispettivi;
  const step = c.corrispettivoAnnuoSteps[0];

  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <h2 className="font-semibold text-stone-900">Corrispettivi</h2>
      <p className="text-xs text-stone-600">
        Corrispettivo annuo (EUR/POD/anno) a copertura costi commercializzazione + spread
        consumo (EUR/kWh) aggiunto al PUN Index GME.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldNumber
          label="Corrispettivo annuo (EUR/POD/anno)"
          value={step.valoreEur}
          step={1}
          onChange={(val) =>
            update("corrispettivi", {
              ...c,
              corrispettivoAnnuoSteps: [{ daMese: 1, aMese: null, valoreEur: val }],
            })
          }
        />
        <FieldNumber
          label="Spread consumo (EUR/kWh) sopra PUN"
          value={c.spreadEurPerUnita}
          step={0.001}
          onChange={(val) => update("corrispettivi", { ...c, spreadEurPerUnita: val })}
        />
        <FieldSelect
          label="Indice di riferimento"
          value={c.indiceRiferimento}
          options={[
            { value: "PUN", label: "PUN Index GME (elettrico)" },
            { value: "PSV", label: "PSV (gas — Enterprise)", disabled: true },
          ]}
          onChange={(val) =>
            update("corrispettivi", {
              ...c,
              indiceRiferimento: val as typeof c.indiceRiferimento,
            })
          }
        />
        <FieldSelect
          label="Periodicità aggiornamento"
          value={c.periodicitaIndice}
          options={[
            { value: "mensile", label: "Mensile (standard ARERA)" },
            { value: "trimestrale", label: "Trimestrale" },
            { value: "semestrale", label: "Semestrale" },
          ]}
          onChange={(val) =>
            update("corrispettivi", {
              ...c,
              periodicitaIndice: val as typeof c.periodicitaIndice,
            })
          }
        />
      </div>
      <p className="text-xs text-stone-500 italic pt-2 border-t border-stone-200">
        Formula prezzo finale per kWh: <code>P = PUN<sub>t</sub> + {c.spreadEurPerUnita.toFixed(4)} €/kWh</code>{" "}
        (per fascia F0 monoraria).
      </p>
    </section>
  );
}

function StepServizi({ offer, update }: StepProps) {
  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <h2 className="font-semibold text-stone-900">Servizi aggiuntivi</h2>
      <p className="text-xs text-stone-600">
        Opzionale. Es. assistenza tecnica 24/7, monitoraggio consumi, garanzia origine
        rinnovabile, bonus in bolletta.
      </p>
      {offer.servizi.length === 0 && (
        <p className="text-sm text-stone-500 italic">
          Nessun servizio aggiuntivo dichiarato. Click sotto per aggiungerne uno (max 3 in demo).
        </p>
      )}
      {offer.servizi.map((s, idx) => (
        <div key={idx} className="rounded-lg border border-stone-200 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={s.nome}
              onChange={(e) => {
                const next = [...offer.servizi];
                next[idx] = { ...s, nome: e.target.value };
                update("servizi", next);
              }}
              placeholder="Nome servizio (es. 'Assistenza Tecnica 24/7')"
              className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => update("servizi", offer.servizi.filter((_, i) => i !== idx))}
              aria-label="Rimuovi servizio"
              className="text-xs text-stone-500 hover:text-rose-700 px-2"
            >
              rimuovi
            </button>
          </div>
          <textarea
            value={s.descrizione}
            onChange={(e) => {
              const next = [...offer.servizi];
              next[idx] = { ...s, descrizione: e.target.value };
              update("servizi", next);
            }}
            rows={3}
            placeholder="Descrizione del servizio (min 20 caratteri per compliance ARERA)"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
          <label className="text-xs flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.incluso}
              onChange={(e) => {
                const next = [...offer.servizi];
                next[idx] = { ...s, incluso: e.target.checked };
                update("servizi", next);
              }}
            />
            Servizio incluso senza costi aggiuntivi
          </label>
        </div>
      ))}
      <button
        type="button"
        disabled={offer.servizi.length >= 3}
        onClick={() =>
          update("servizi", [
            ...offer.servizi,
            { nome: "", descrizione: "", incluso: true, features: [] },
          ])
        }
        className="px-3 py-2 rounded-md border border-sky-300 text-sky-700 text-sm font-semibold hover:bg-sky-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Aggiungi servizio {offer.servizi.length >= 3 ? "(max 3 in demo)" : ""}
      </button>
    </section>
  );
}

function StepTermini({ offer, update }: StepProps) {
  const t = offer.termini;
  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <h2 className="font-semibold text-stone-900">Termini contrattuali</h2>
      <p className="text-xs text-stone-600">
        Modalità pagamento, durata, recesso. Preavviso minimo 3 mesi imposto da Del.
        302/2016/R/com.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldSelect
          label="Frequenza fatturazione"
          value={t.frequenzaFatturazione}
          options={[
            { value: "mensile", label: "Mensile" },
            { value: "bimestrale", label: "Bimestrale (default residenziale)" },
            { value: "trimestrale", label: "Trimestrale" },
          ]}
          onChange={(val) =>
            update("termini", {
              ...t,
              frequenzaFatturazione: val as typeof t.frequenzaFatturazione,
            })
          }
        />
        <FieldNumber
          label="Giorni pagamento dalla fattura"
          value={t.giorniPagamento}
          step={1}
          onChange={(val) => update("termini", { ...t, giorniPagamento: val })}
        />
        <FieldNumber
          label="Durata condizioni economiche (mesi)"
          value={t.durataCondizioniMesi}
          step={1}
          onChange={(val) => update("termini", { ...t, durataCondizioniMesi: val })}
        />
        <FieldNumber
          label="Preavviso modifica (mesi, min 3)"
          value={t.preavvisoModificaMesi}
          step={1}
          onChange={(val) => update("termini", { ...t, preavvisoModificaMesi: val })}
        />
        <FieldText
          label="Oneri recesso anticipato (deve essere 'Nessuno')"
          value={t.oneriRecessoAnticipato}
          onChange={(val) => update("termini", { ...t, oneriRecessoAnticipato: val })}
        />
        <FieldNumber
          label="Deposito cauzionale (EUR per kW)"
          value={t.depositoEurPerKw}
          step={0.5}
          onChange={(val) => update("termini", { ...t, depositoEurPerKw: val })}
        />
      </div>
    </section>
  );
}

function StepValidazione({
  validation,
}: {
  validation: ReturnType<typeof validateCTEOffer>;
}) {
  // Group by section
  const bySection = useMemo(() => {
    const grouped: Record<string, ValidationCheck[]> = {};
    for (const c of validation.checks) {
      if (!grouped[c.section]) grouped[c.section] = [];
      grouped[c.section].push(c);
    }
    return grouped;
  }, [validation]);

  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-stone-900">Validazione ARERA-compliance</h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${
            validation.complianceScore >= 90
              ? "bg-emerald-100 text-emerald-800"
              : validation.complianceScore >= 70
                ? "bg-amber-100 text-amber-800"
                : "bg-rose-100 text-rose-800"
          }`}
        >
          Score {validation.complianceScore}/100
        </span>
      </div>

      {Object.entries(bySection).map(([section, checks]) => (
        <div key={section} className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">{section}</h3>
          <ul className="space-y-1">
            {checks.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function StepAnteprima({
  offer,
  scheda,
  validation,
  onPrint,
}: {
  offer: CTEOffer;
  scheda: ReturnType<typeof generaSchedaConfrontabilita>;
  validation: ReturnType<typeof validateCTEOffer>;
  onPrint: () => void;
}) {
  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-stone-900">Anteprima & Stampa CTE</h2>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0a3d2e] text-white text-sm font-semibold hover:bg-[#0a3d2e]/90"
        >
          🖨️ Stampa CTE PDF
        </button>
      </div>
      <p className="text-[11px] text-amber-700 font-medium">
        ⚠ Il PDF stampato include watermark &quot;DEMO&quot; diagonale su tutte le pagine
      </p>

      {validation.summary.errors > 0 && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm">
          <strong className="text-rose-900">
            {validation.summary.errors} errore/i compliance da risolvere prima della stampa.
          </strong>
          <p className="text-xs text-rose-800 mt-1">
            Torna allo step Validazione per dettagli.
          </p>
        </div>
      )}

      {/* Live preview Scheda Sintetica + Confrontabilità */}
      <div className="border border-stone-300 rounded-lg overflow-hidden">
        <CTEPrintPreview
          offer={offer}
          scheda={scheda}
          punForecastEurPerMwh={scheda.punForecastEurPerMwh}
        />
      </div>
    </section>
  );
}

// ============================================================
// VALIDATION SIDEBAR
// ============================================================

function ValidationSummary({
  validation,
}: {
  validation: ReturnType<typeof validateCTEOffer>;
}) {
  const { complianceScore, summary } = validation;
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        Compliance ARERA
      </h2>
      <div
        className={`rounded-xl p-4 text-center ${
          complianceScore >= 90
            ? "bg-emerald-50 border border-emerald-200"
            : complianceScore >= 70
              ? "bg-amber-50 border border-amber-200"
              : "bg-rose-50 border border-rose-200"
        }`}
      >
        <p className="text-xs uppercase text-stone-500 mb-1">Score</p>
        <p
          className={`text-4xl font-bold tabular-nums ${
            complianceScore >= 90
              ? "text-emerald-700"
              : complianceScore >= 70
                ? "text-amber-700"
                : "text-rose-700"
          }`}
        >
          {complianceScore}
        </p>
        <p className="text-xs text-stone-500">/ 100</p>
      </div>
      <ul className="text-sm space-y-1.5">
        <li className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <strong className="tabular-nums">{summary.passed}</strong> passati
        </li>
        <li className="flex items-center gap-2 text-rose-700">
          <XCircle className="h-4 w-4" aria-hidden />
          <strong className="tabular-nums">{summary.errors}</strong> errori critici
        </li>
        <li className="flex items-center gap-2 text-amber-700">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <strong className="tabular-nums">{summary.warnings}</strong> warning
        </li>
        <li className="flex items-center gap-2 text-stone-500 text-xs pt-1 border-t border-stone-200">
          <Info className="h-3.5 w-3.5" aria-hidden />
          {summary.total} check totali eseguiti
        </li>
      </ul>
      <div className="text-[11px] text-stone-500 pt-2 border-t border-stone-200">
        <p className="font-semibold mb-1">Riferimenti normativi:</p>
        <ul className="space-y-0.5">
          <li>• Del. 302/2016/R/com — Recesso</li>
          <li>• Del. 569/2019/R/com — TIQE/RQDG</li>
          <li>• Del. 25/2025/R/com — Schede Sintetiche</li>
          <li>• Codice Condotta Commerciale</li>
        </ul>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: ValidationCheck }) {
  const Icon = check.passed ? CheckCircle2 : check.severity === "error" ? XCircle : AlertCircle;
  const colorClass = check.passed
    ? "text-emerald-700"
    : check.severity === "error"
      ? "text-rose-700"
      : check.severity === "warning"
        ? "text-amber-700"
        : "text-stone-600";
  return (
    <li className={`flex items-start gap-2 text-xs ${colorClass}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
      <span>{check.message}</span>
    </li>
  );
}

// ============================================================
// PDF PRINT PREVIEW
// ============================================================

function CTEPrintPreview({
  offer,
  scheda,
  punForecastEurPerMwh,
}: {
  offer: CTEOffer;
  scheda: ReturnType<typeof generaSchedaConfrontabilita>;
  punForecastEurPerMwh: number;
}) {
  const validitaDate = `dal ${offer.identificazione.validitaDal} al ${offer.identificazione.validitaAl}`;
  const step = offer.corrispettivi.corrispettivoAnnuoSteps[0];

  return (
    <article className="bg-white p-6 sm:p-10 space-y-6 text-stone-900 text-sm">
      {/* HEADER */}
      <header className="bg-[#0a3d2e] text-white p-5 -mx-6 sm:-mx-10 -mt-6 sm:-mt-10 mb-6">
        <div className="text-[10px] uppercase tracking-widest opacity-80">
          CTE — Condizioni Tecnico Economiche
        </div>
        <h1 className="text-2xl font-bold mt-1">{offer.identificazione.nomeOfferta}</h1>
        <p className="text-xs opacity-90 mt-1">
          {offer.venditore.ragioneSociale} · Codice {offer.identificazione.codiceOfferta}
        </p>
      </header>

      {/* SCHEDA SINTETICA */}
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-base font-bold uppercase tracking-wide text-stone-700 border-b-2 border-[#0a3d2e] pb-1">
          Scheda Sintetica
        </h2>
        <table className="w-full text-xs">
          <tbody>
            <RowKV k="Venditore" v={offer.venditore.ragioneSociale} />
            <RowKV k="Sito web" v={offer.venditore.sitoWeb} />
            <RowKV k="Numero verde" v={offer.venditore.numeroVerde} />
            <RowKV k="Durata contratto" v={String(offer.identificazione.durataContratto)} />
            <RowKV k="Validità offerta" v={validitaDate} />
            <RowKV k="Segmento" v={offer.identificazione.segmento} />
            <RowKV k="Tipologia mercato" v={offer.identificazione.tipologiaMercato} />
            <RowKV
              k="Frequenza fatturazione"
              v={offer.termini.frequenzaFatturazione}
            />
            <RowKV
              k="Termine pagamento"
              v={`${offer.termini.giorniPagamento} giorni dalla data emissione`}
            />
          </tbody>
        </table>
      </section>

      {/* CONDIZIONI ECONOMICHE */}
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-base font-bold uppercase tracking-wide text-stone-700 border-b-2 border-[#0a3d2e] pb-1">
          Condizioni economiche
        </h2>
        <table className="w-full text-xs">
          <tbody>
            <RowKV
              k="Prezzo"
              v={
                offer.strutturaPrezzo === "variabile"
                  ? "Variabile, indicizzato PUN Index GME"
                  : "Fisso"
              }
            />
            <RowKV k="Corrispettivo annuo" v={`${step.valoreEur} €/POD/anno`} />
            <RowKV
              k="Corrispettivo consumo"
              v={`PUN + ${offer.corrispettivi.spreadEurPerUnita.toFixed(4)} €/kWh`}
            />
            <RowKV k="Periodicità indice" v={offer.corrispettivi.periodicitaIndice} />
            <RowKV
              k="PUN forecast medio"
              v={`${EUR2.format(punForecastEurPerMwh)} €/MWh (riferimento Energy Index)`}
            />
          </tbody>
        </table>
      </section>

      {/* SCHEDA DI CONFRONTABILITÀ */}
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-base font-bold uppercase tracking-wide text-stone-700 border-b-2 border-[#0a3d2e] pb-1">
          Scheda di Confrontabilità — Spesa annua stimata
        </h2>
        <p className="text-[10px] text-stone-600 italic">
          Stima escluse imposte e tasse. Confronto con Servizio Maggior Tutela (proxy ARERA
          2026 — disponibile solo per clienti vulnerabili come da normativa vigente).
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-stone-300">
              <th className="text-left py-1.5">Profilo</th>
              <th className="text-right py-1.5">Offerta (A)</th>
              <th className="text-right py-1.5">Maggior Tutela (B)</th>
              <th className="text-right py-1.5">Differenza (A-B)</th>
              <th className="text-right py-1.5">Δ%</th>
            </tr>
          </thead>
          <tbody>
            {scheda.rows.map((r) => (
              <tr key={r.profilo.id} className="border-b border-stone-100">
                <td className="py-1.5">{r.profilo.label}</td>
                <td className="text-right tabular-nums">{EUR2.format(r.spesaOffertaEur)}</td>
                <td className="text-right tabular-nums">
                  {EUR2.format(r.spesaMaggiorTutelaEur)}
                </td>
                <td
                  className={`text-right tabular-nums font-semibold ${
                    r.delta > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {r.delta >= 0 ? "+" : ""}
                  {EUR2.format(r.delta)}
                </td>
                <td
                  className={`text-right tabular-nums ${
                    r.deltaPct > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {r.deltaPct >= 0 ? "+" : ""}
                  {r.deltaPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* SERVIZI AGGIUNTIVI */}
      {offer.servizi.length > 0 && (
        <section className="space-y-2 print:break-inside-avoid">
          <h2 className="text-base font-bold uppercase tracking-wide text-stone-700 border-b-2 border-[#0a3d2e] pb-1">
            Prodotti e/o servizi aggiuntivi
          </h2>
          {offer.servizi.map((s, i) => (
            <div key={i} className="text-xs">
              <strong>{s.nome}</strong> {s.incluso && <em>(servizio incluso)</em>}: {s.descrizione}
            </div>
          ))}
        </section>
      )}

      {/* DIRITTO DI RIPENSAMENTO */}
      <section className="space-y-2 print:break-inside-avoid text-xs leading-relaxed">
        <h2 className="text-base font-bold uppercase tracking-wide text-stone-700 border-b-2 border-[#0a3d2e] pb-1">
          Diritto di ripensamento
        </h2>
        <p>
          Nel caso in cui il Contratto sia concluso fuori dai locali commerciali del Fornitore
          o a distanza, il Cliente ha facoltà di esercitare il diritto di ripensamento entro 14
          (quattordici) giorni dalla data di ricevimento della comunicazione di accettazione.
          Il periodo è prolungato a 30 giorni qualora il Contratto sia concluso nel contesto di
          visite non richieste o escursioni organizzate dal Fornitore. Modulo per esercizio del
          ripensamento allegato.
        </p>
      </section>

      {/* MODALITÀ E ONERI RECESSO */}
      <section className="space-y-2 print:break-inside-avoid text-xs leading-relaxed">
        <h2 className="text-base font-bold uppercase tracking-wide text-stone-700 border-b-2 border-[#0a3d2e] pb-1">
          Modalità e oneri per il recesso
        </h2>
        <p>
          Il Cliente può esercitare il diritto di recesso senza oneri in qualsiasi momento
          della fornitura, nel rispetto dei seguenti termini di preavviso: (i) entro il giorno
          10 del mese precedente la data di cambio venditore se esercitato per cambiare
          fornitore; (ii) 1 mese se esercitato per cessare la fornitura, ai sensi della Delibera
          302/2016/R/com.
        </p>
        <p>
          <strong>Oneri di recesso anticipato:</strong> {offer.termini.oneriRecessoAnticipato}.
        </p>
      </section>

      {/* RECLAMI */}
      <section className="space-y-2 print:break-inside-avoid text-xs leading-relaxed">
        <h2 className="text-base font-bold uppercase tracking-wide text-stone-700 border-b-2 border-[#0a3d2e] pb-1">
          Reclami e risoluzione controversie
        </h2>
        <p>
          Per reclami contattare {offer.venditore.ragioneSociale} all&apos;email{" "}
          {offer.venditore.emailContatto} o al numero verde {offer.venditore.numeroVerde}.
          In caso di mancata risposta dopo 30 giorni o risposta non soddisfacente è possibile
          attivare la procedura di conciliazione presso lo Sportello per il consumatore Energia
          ARERA (numero verde 800.166.654).
        </p>
        <p>
          <strong>Se Lei è un cliente vulnerabile</strong>, come definito dalla normativa
          vigente, può scegliere in alternativa all&apos;offerta di cui alla presente Scheda le
          condizioni economiche e contrattuali del Servizio di Maggior Tutela. Per ulteriori
          informazioni consulti{" "}
          <a href="https://www.arera.it/consumatori">www.arera.it/consumatori</a> o il numero
          verde 800.166.654.
        </p>
      </section>

      {/* PORTALE OFFERTE */}
      <section className="space-y-2 print:break-inside-avoid text-xs leading-relaxed bg-stone-50 p-3 border-l-4 border-[#0a3d2e]">
        <p>
          Per informazioni sulla spesa personalizzata e su altre offerte disponibili nel
          mercato può consultare il <strong>Portale Offerte Luce e Gas</strong>{" "}
          <a href="https://www.ilportaleofferte.it">www.ilportaleofferte.it</a>.
        </p>
      </section>

      {/* OPERATORE COMMERCIALE */}
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-base font-bold uppercase tracking-wide text-stone-700 border-b-2 border-[#0a3d2e] pb-1">
          Operatore commerciale
        </h2>
        <table className="w-full text-xs border border-stone-300">
          <tbody>
            <tr className="border-b border-stone-300">
              <td className="w-1/3 p-2 bg-stone-50 font-semibold">Codice identificativo</td>
              <td className="p-2">_______________________________</td>
            </tr>
            <tr>
              <td className="p-2 bg-stone-50 font-semibold">Firma e data</td>
              <td className="p-2">_______________________________</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* DOCUMENTI ALLEGATI */}
      <section className="space-y-1 print:break-inside-avoid text-xs">
        <h2 className="text-base font-bold uppercase tracking-wide text-stone-700 border-b-2 border-[#0a3d2e] pb-1">
          Documenti allegati alla Scheda Sintetica
        </h2>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Modulo per l&apos;esercizio del ripensamento</li>
          <li>Livelli di qualità commerciale (Del. 569/2019/R/com)</li>
          <li>Composizione mix energetico (D.lgs. 28/2011)</li>
          <li>Informativa privacy GDPR (Reg. UE 2016/679)</li>
        </ul>
      </section>

      {/* FOOTER */}
      <footer className="border-t-2 border-[#0a3d2e] pt-2 text-[10px] text-stone-600 flex flex-wrap justify-between gap-2">
        <span>
          {offer.venditore.ragioneSociale} · P.IVA {offer.venditore.partitaIva} ·{" "}
          {offer.venditore.sedeLegale}, {offer.venditore.cap} {offer.venditore.citta} (
          {offer.venditore.provincia})
        </span>
        <span>
          CTE generata con EIDX Pro · {NUM0.format(scheda.rows.length)} profili confronto ·{" "}
          {new Date(scheda.calculatedAt).toLocaleDateString("it-IT")}
        </span>
      </footer>

      {/* DEMO BANNER (only when not printing — overridden by print CSS watermark) */}
      <div className="text-center pt-3 border-t border-amber-300 bg-amber-50/40 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 mt-6 p-3 print:hidden">
        <p className="text-xs text-amber-800">
          <Lock className="h-3 w-3 inline mr-1" aria-hidden />
          <strong>Demo:</strong> CTE generata per anteprima. Per produrre CTE finali con
          branding custom e submission al Portale Offerte ARERA,{" "}
          <Link href="/it/pro#early-access" className="underline font-bold">
            sblocca Enterprise
          </Link>
          .
        </p>
      </div>
    </article>
  );
}

// ============================================================
// SHARED FORM FIELDS
// ============================================================

function FieldText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-stone-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}

function FieldDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-stone-700">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono tabular-nums"
      />
    </label>
  );
}

function FieldNumber({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (val: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-stone-700">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono tabular-nums"
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  onChange: (val: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-stone-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-stone-100">
      <td className="w-1/3 py-1 bg-stone-50/50 font-semibold pr-2">{k}</td>
      <td className="py-1 break-words">{v}</td>
    </tr>
  );
}
