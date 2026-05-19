"use client";

import { useState } from "react";
import { FileText, Lock } from "lucide-react";
import { DemoLockBanner } from "./DemoLockBanner";

const EUR2 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT1 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Default brand color enforced in demo (no custom branding) */
const DEMO_BRAND_COLOR = "#0a3d2e";

export interface ReportSnapshot {
  latestPrices: Array<{ slug: string; name: string; unit: string; value: number; observedAt: string }>;
  fc30: Array<{ slug: string; name: string; unit: string; value: number }>;
  fc90: Array<{ slug: string; name: string; unit: string; value: number }>;
  metrics: Array<{ slug: string; horizon: number; mape: number | null; hitRatio: number | null }>;
  generatedAt: string;
}

function handlePrint() {
  if (typeof window === "undefined") return;
  window.print();
}

export function ReportBuilderView({ snapshot }: { snapshot: ReportSnapshot }) {
  const [companyName, setCompanyName] = useState("La Tua Azienda Energy S.r.l.");
  const [clientName, setClientName] = useState("Cliente Esempio S.p.A.");
  // Brand color e logo lockati nel demo — forzati a default EIDX, niente custom branding
  const brandColor = DEMO_BRAND_COLOR;
  const logoUrl = "";

  const reportDate = new Date(snapshot.generatedAt).toLocaleDateString("it-IT", {
    year: "numeric", month: "long", day: "numeric",
  });
  const reportMonth = new Date(snapshot.generatedAt).toLocaleDateString("it-IT", {
    year: "numeric", month: "long",
  });

  return (
    <div className="space-y-4">
      <DemoLockBanner
        icon={FileText}
        title="Demo: PDF stampabile con watermark 'DEMO', branding custom (logo + colore) lockato."
        description="Tier Enterprise 3.500€/mese: white-label completo (logo + palette cliente), schedulazione automatica monthly/weekly, distribuzione mailing list, custom research on-demand."
        ctaLabel="Sblocca Enterprise"
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* CONFIGURATORE */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5 h-fit print:hidden">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Personalizza</h2>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-stone-700">Nome azienda (intestatario)</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            placeholder="La tua azienda..."
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-stone-700">Nome cliente destinatario</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            placeholder="Cliente destinatario..."
          />
        </div>

        {/* LOCKED: colore brand */}
        <div className="space-y-1 opacity-60" title="Branding custom su tier Enterprise 3.500€/mese">
          <label className="block text-xs font-medium text-stone-700 inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-amber-600" aria-hidden />
            Colore brand (header)
            <span className="ml-auto text-[10px] font-bold uppercase text-amber-700">Enterprise</span>
          </label>
          <div className="flex items-center gap-2">
            <div
              className="h-9 w-12 rounded border border-stone-300"
              style={{ backgroundColor: DEMO_BRAND_COLOR }}
              aria-label="Colore brand fisso (demo)"
            />
            <input
              type="text"
              value={DEMO_BRAND_COLOR}
              disabled
              className="flex-1 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-mono text-stone-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* LOCKED: URL logo */}
        <div className="space-y-1 opacity-60" title="Logo custom su tier Enterprise 3.500€/mese">
          <label className="block text-xs font-medium text-stone-700 inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-amber-600" aria-hidden />
            URL logo
            <span className="ml-auto text-[10px] font-bold uppercase text-amber-700">Enterprise</span>
          </label>
          <input
            type="url"
            value=""
            disabled
            className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500 cursor-not-allowed"
            placeholder="https://logo.cliente.it/logo.svg"
          />
          <p className="text-xs text-stone-500">PNG/SVG, max 200x60px consigliato</p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-[#0a3d2e] text-white text-sm font-semibold shadow-sm hover:bg-[#0a3d2e]/90 transition-colors"
        >
          <span aria-hidden>🖨️</span>
          Stampa / Salva PDF
        </button>
        <p className="text-[11px] text-amber-700 font-medium text-center">
          ⚠ La stampa includera&apos; watermark &quot;DEMO&quot;
        </p>
      </div>

      {/* PREVIEW REPORT */}
      <div className="space-y-4 print:space-y-0">
        <div className="text-xs text-stone-500 print:hidden">Preview report — sara&apos; stampato cosi&apos;:</div>

        {/* ===== REPORT START ===== */}
        <article className="bg-white rounded-xl border border-stone-200 print:border-0 print:rounded-none overflow-hidden">
          {/* HEADER brandizzato */}
          <header style={{ backgroundColor: brandColor }} className="text-white p-6 print:p-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest opacity-80">Report mensile mercato energy</div>
              <h1 className="text-xl font-bold">{reportMonth}</h1>
              <p className="text-xs opacity-90 mt-1">Per: <strong>{clientName}</strong></p>
            </div>
            <div className="text-right">
              {logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt="logo" className="max-h-12 mb-2" />
              )}
              <div className="text-xs opacity-80">{companyName}</div>
              <div className="text-xs opacity-60 mt-0.5">{reportDate}</div>
            </div>
          </header>

          {/* BODY */}
          <div className="p-6 print:p-4 space-y-6 print:space-y-4">

            {/* SECTION 1: Market snapshot */}
            <section className="space-y-2 print:break-inside-avoid">
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-700 border-b border-stone-200 pb-1">
                1. Snapshot mercato corrente
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {snapshot.latestPrices.map((p) => (
                  <div key={p.slug} className="text-center">
                    <div className="text-xs text-stone-500 uppercase">{p.name.split("—")[0].trim()}</div>
                    <div className="text-lg font-bold tabular-nums">{EUR2.format(p.value)}</div>
                    <div className="text-xs text-stone-500">{p.unit}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION 2: Forecast 30g + 90g */}
            <section className="space-y-2 print:break-inside-avoid">
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-700 border-b border-stone-200 pb-1">
                2. Forecast PUN/PSV/TTF
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left py-1.5">Asset</th>
                    <th className="text-right py-1.5">Spot oggi</th>
                    <th className="text-right py-1.5">Forecast 30g</th>
                    <th className="text-right py-1.5">Forecast 90g</th>
                  </tr>
                </thead>
                <tbody>
                  {["pun", "psv", "ttf"].map((slug) => {
                    const spot = snapshot.latestPrices.find((p) => p.slug === slug);
                    const f30 = snapshot.fc30.find((p) => p.slug === slug);
                    const f90 = snapshot.fc90.find((p) => p.slug === slug);
                    return (
                      <tr key={slug} className="border-b border-stone-100">
                        <td className="py-1.5 font-medium">{spot?.name.split("—")[0].trim() ?? slug.toUpperCase()}</td>
                        <td className="text-right tabular-nums">{spot ? EUR2.format(spot.value) : "—"}</td>
                        <td className="text-right tabular-nums">{f30 ? EUR2.format(f30.value) : "—"}</td>
                        <td className="text-right tabular-nums">{f90 ? EUR2.format(f90.value) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-stone-500 italic">Valori in EUR/MWh. Modello Ridge v1.0 — vedi metriche affidabilita&apos; nella sezione 3.</p>
            </section>

            {/* SECTION 3: Track record */}
            <section className="space-y-2 print:break-inside-avoid">
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-700 border-b border-stone-200 pb-1">
                3. Affidabilita&apos; del modello
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left py-1.5">Asset</th>
                    <th className="text-right py-1.5">Orizzonte</th>
                    <th className="text-right py-1.5">MAPE</th>
                    <th className="text-right py-1.5">Hit ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.metrics
                    .filter((m) => ["pun", "psv"].includes(m.slug))
                    .sort((a, b) => a.slug.localeCompare(b.slug) || a.horizon - b.horizon)
                    .map((m) => (
                      <tr key={`${m.slug}-${m.horizon}`} className="border-b border-stone-100">
                        <td className="py-1.5 font-medium">{m.slug.toUpperCase()}</td>
                        <td className="text-right">{m.horizon}g</td>
                        <td className="text-right tabular-nums">{m.mape !== null ? `${PCT1.format(m.mape)}%` : "—"}</td>
                        <td className="text-right tabular-nums">{m.hitRatio !== null ? `${(m.hitRatio * 100).toFixed(0)}%` : "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="text-xs text-stone-500 italic">MAPE = errore percentuale medio; hit ratio = % direzione indovinata.</p>
            </section>

            {/* SECTION 4: Conclusion */}
            <section className="space-y-2 print:break-inside-avoid">
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-700 border-b border-stone-200 pb-1">
                4. Note finali
              </h2>
              <p className="text-sm leading-relaxed">
                Questo report e&apos; generato automaticamente dai dati Energy Index (energyindex.it).
                Forecast sono indicativi e basati sul modello Ridge regression v1.0. Non costituiscono
                consulenza finanziaria o raccomandazione di acquisto/vendita. Per approfondimenti su
                metodologia, scenari custom e tier Pro: <a href="https://energyindex.it/it/pro" style={{ color: brandColor }}>energyindex.it/pro</a>.
              </p>
            </section>
          </div>

          {/* FOOTER report */}
          <footer style={{ borderTopColor: brandColor }} className="border-t-2 p-4 print:p-3 flex items-center justify-between text-xs text-stone-600">
            <span>{companyName} · powered by Energy Index</span>
            <span>Pagina 1/1 · {reportDate}</span>
          </footer>
        </article>
        {/* ===== REPORT END ===== */}
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .container { padding: 0 !important; max-width: 100% !important; }
          @page { margin: 1cm; }
          /* Watermark "DEMO" diagonale su ogni pagina stampata.
             Deterrente per evitare che utenti gratis usino il PDF in produzione. */
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
    </div>
  );
}
