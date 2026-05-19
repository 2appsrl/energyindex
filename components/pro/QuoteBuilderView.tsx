"use client";

import { useMemo, useState } from "react";
import { ClipboardSignature, Lock } from "lucide-react";
import { DemoLockBanner } from "./DemoLockBanner";

const EUR2 = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

type TemplateId = "pmi-fisso-12" | "domestico-variabile" | "industriale-fisso-24";

interface TemplateDef {
  id: TemplateId;
  label: string;
  description: string;
  contractType: "fisso" | "variabile";
  contractMonths: number;
  spreadEurPerMwh: number;
  recommendedFor: string;
  locked: boolean;
}

const TEMPLATES: TemplateDef[] = [
  {
    id: "pmi-fisso-12",
    label: "PMI · Fisso 12 mesi",
    description:
      "Offerta standard per piccole-medie imprese commerciali (negozi, ristoranti, uffici). Prezzo fisso 12 mesi, certezza budget annuale.",
    contractType: "fisso",
    contractMonths: 12,
    spreadEurPerMwh: 12,
    recommendedFor: "PMI 50.000 - 500.000 kWh/anno",
    locked: false,
  },
  {
    id: "domestico-variabile",
    label: "Domestico · Variabile PUN",
    description: "Offerta passthrough PUN per famiglie. Bolletta segue il mercato.",
    contractType: "variabile",
    contractMonths: 12,
    spreadEurPerMwh: 8,
    recommendedFor: "Casa famiglia 2.000 - 5.000 kWh/anno",
    locked: true,
  },
  {
    id: "industriale-fisso-24",
    label: "Industriale · Fisso 24 mesi",
    description:
      "Prezzo bloccato 2 anni per industrie energivore. Pricing su misura, sconto volume.",
    contractType: "fisso",
    contractMonths: 24,
    spreadEurPerMwh: 6,
    recommendedFor: "Industrie 1M+ kWh/anno",
    locked: true,
  },
];

const DEMO_FORECAST_PUN = 110;

export function QuoteBuilderView() {
  const [selectedId, setSelectedId] = useState<TemplateId>("pmi-fisso-12");
  const [companyName, setCompanyName] = useState("La Tua Azienda Energy S.r.l.");
  const [clientName, setClientName] = useState("Cliente Esempio S.p.A.");
  const [annualKwh, setAnnualKwh] = useState(250_000);

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === selectedId)!,
    [selectedId],
  );

  const finalPricePerMwh = DEMO_FORECAST_PUN + template.spreadEurPerMwh;
  const annualCost = (finalPricePerMwh / 1000) * annualKwh;
  const today = new Date().toLocaleDateString("it-IT");

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  return (
    <div className="space-y-4">
      <DemoLockBanner
        icon={ClipboardSignature}
        title="Demo: 1 template sbloccato (PMI fisso), altri 2 lockati. PDF stampato con watermark DEMO."
        description="Tier Pro 499€/mese: 10+ template, branding custom (logo + colore), salvataggio per cliente, distribuzione email integrata."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* INPUT */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5 h-fit print:hidden">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Template offerta
          </h2>

          <div className="space-y-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => !t.locked && setSelectedId(t.id)}
                disabled={t.locked}
                className={`w-full text-left rounded-lg border p-3 transition-all ${
                  t.id === selectedId
                    ? "border-emerald-500 bg-emerald-50/60"
                    : t.locked
                      ? "border-amber-300/50 bg-amber-50/30 cursor-not-allowed opacity-75"
                      : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                    {t.locked && <Lock className="h-3 w-3 text-amber-600" aria-hidden />}
                    {t.label}
                  </span>
                  {t.locked && (
                    <span className="text-[9px] font-bold uppercase text-amber-700">
                      Pro 499€
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-600 mt-1">{t.recommendedFor}</p>
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-stone-700">
              Nome azienda (tua)
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-stone-700">
              Nome cliente (destinatario)
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-stone-700">
              Consumo annuo cliente (kWh) — {NUM0.format(annualKwh)}
            </label>
            <input
              type="range"
              min={10_000}
              max={2_000_000}
              step={5000}
              value={annualKwh}
              onChange={(e) => setAnnualKwh(Number(e.target.value))}
              className="w-full accent-emerald-700"
              aria-label="Consumo annuo"
            />
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-[#0a3d2e] text-white text-sm font-semibold shadow-sm hover:bg-[#0a3d2e]/90 transition-colors"
          >
            <span aria-hidden>🖨️</span>
            Stampa quote PDF
          </button>
          <p className="text-[11px] text-amber-700 font-medium text-center">
            ⚠ Stampa con watermark &quot;DEMO&quot;
          </p>
        </div>

        {/* QUOTE PREVIEW */}
        <div className="space-y-3 print:space-y-0 min-w-0">
          <div className="text-xs text-stone-500 print:hidden">
            Preview quote — verra&apos; stampato cosi&apos;:
          </div>

          <article className="bg-white rounded-xl border border-stone-200 print:border-0 print:rounded-none overflow-hidden">
            {/* HEADER */}
            <header className="bg-[#0a3d2e] text-white p-6 print:p-4 flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-widest opacity-80">
                  Quote commerciale
                </div>
                <h1 className="text-xl font-bold">{template.label}</h1>
                <p className="text-xs opacity-90 mt-1">
                  Per: <strong>{clientName}</strong>
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-80">{companyName}</div>
                <div className="text-xs opacity-60 mt-0.5">{today}</div>
              </div>
            </header>

            {/* BODY */}
            <div className="p-6 print:p-4 space-y-5 print:space-y-3">
              <section className="space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-stone-700 border-b border-stone-200 pb-1">
                  1. Termini contratto
                </h2>
                <ul className="text-sm space-y-1">
                  <Row
                    label="Tipo offerta"
                    value={
                      template.contractType === "fisso"
                        ? "Prezzo fisso"
                        : "Variabile (passthrough PUN)"
                    }
                  />
                  <Row label="Durata" value={`${template.contractMonths} mesi`} />
                  <Row
                    label="Spread vendita"
                    value={`${template.spreadEurPerMwh.toFixed(1)} €/MWh`}
                  />
                  <Row
                    label="Consumo annuo previsto"
                    value={`${NUM0.format(annualKwh)} kWh/anno`}
                  />
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-stone-700 border-b border-stone-200 pb-1">
                  2. Calcolo economico (proiezione)
                </h2>
                <ul className="text-sm space-y-1">
                  <Row
                    label="PUN forecast medio"
                    value={`${EUR2.format(DEMO_FORECAST_PUN)} €/MWh`}
                  />
                  <Row
                    label="Prezzo finale all-in"
                    value={`${EUR2.format(finalPricePerMwh)} €/MWh`}
                    highlight
                  />
                  <Row
                    label="Costo commodity annuo stimato"
                    value={`${EUR2.format(annualCost)} €/anno`}
                    highlight
                  />
                  <Row
                    label="Costo mensile medio"
                    value={`${EUR2.format(annualCost / 12)} €/mese`}
                  />
                </ul>
                <p className="text-[11px] text-stone-500 italic mt-2">
                  Costo commodity al netto di accise, IVA, oneri di sistema, tariffe di
                  distribuzione (mediamente +30-40% sulla bolletta finale).
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-stone-700 border-b border-stone-200 pb-1">
                  3. Note
                </h2>
                <p className="text-sm leading-relaxed">{template.description}</p>
                <p className="text-sm leading-relaxed text-stone-600">
                  Forecast PUN basato sul modello Ridge v1.0 di Energy Index
                  (energyindex.it). Quote indicativa, non vincolante. Per accettazione
                  formale contattare {companyName}.
                </p>
              </section>
            </div>

            {/* FOOTER */}
            <footer className="border-t-2 border-[#0a3d2e] p-4 print:p-3 flex items-center justify-between text-xs text-stone-600">
              <span>{companyName} · powered by Energy Index</span>
              <span>{today}</span>
            </footer>
          </article>
        </div>
      </div>

      {/* Watermark DEMO on print */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .container {
            padding: 0 !important;
            max-width: 100% !important;
          }
          @page {
            margin: 1cm;
          }
          body::before {
            content: "DEMO";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 200px;
            font-weight: 900;
            color: rgba(220, 38, 38, 0.18);
            letter-spacing: 0.15em;
            pointer-events: none;
            z-index: 9999;
            font-family: system-ui, -apple-system, sans-serif;
          }
        }
      `}</style>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-stone-600">{label}</span>
      <span
        className={`tabular-nums font-medium ${
          highlight ? "text-emerald-700 font-bold" : "text-stone-900"
        }`}
      >
        {value}
      </span>
    </li>
  );
}

