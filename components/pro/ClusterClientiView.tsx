"use client";

import { useMemo } from "react";
import { rankOffers, type OfferRecord, type ForecastAverages, type OfferRanking } from "@/lib/pro/customer-math";
import { CLUSTERS, type ConsumerCluster } from "@/lib/pro/cluster-data";

const EUR = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("it-IT");

function handlePrint() {
  if (typeof window === "undefined") return;
  window.print();
}

export function ClusterClientiView({
  offers,
  forecast,
  placetLuceFisso,
  placetGasFisso,
  suppliers,
}: {
  offers: OfferRecord[];
  forecast: ForecastAverages;
  placetLuceFisso: number;        // EUR/kWh mediana PLACET
  placetGasFisso: number;          // EUR/Smc mediana PLACET
  suppliers: string[];
}) {
  const clusterResults = useMemo(() => {
    return CLUSTERS.map((c) => {
      const rankedLuce = rankOffers(offers, forecast, c.kwhAnno, "electricity");
      const rankedGas = c.smcAnno > 0 ? rankOffers(offers, forecast, c.smcAnno, "gas") : [];
      const placetLuce = placetLuceFisso * c.kwhAnno;
      const placetGas = c.smcAnno > 0 ? placetGasFisso * c.smcAnno : 0;
      return {
        cluster: c,
        rankedLuce,
        rankedGas,
        placetLuce,
        placetGas,
        placetTotal: placetLuce + placetGas,
      };
    });
  }, [offers, forecast, placetLuceFisso, placetGasFisso]);

  const today = new Date().toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      {/* Action bar - hidden in print */}
      <div className="print:hidden flex items-center justify-between flex-wrap gap-3 pb-2">
        <p className="text-xs text-stone-500">
          {offers.length} offerte mercato libero attive · forecast PUN/PSV 90g
        </p>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0a3d2e] text-white text-sm font-semibold shadow-sm hover:bg-[#0a3d2e]/90 transition-colors"
        >
          <span aria-hidden>🖨️</span>
          Stampa / Salva PDF
        </button>
      </div>

      {/* Print header - visible only when printing */}
      <div className="hidden print:block print:mb-4">
        <div className="border-b-2 border-stone-900 pb-2 mb-3">
          <div className="text-lg font-bold">EIDX · Cluster Clienti</div>
          <div className="text-xs text-stone-700">Confronto offerte mercato libero · {today}</div>
        </div>
      </div>

      {/* Cluster grid */}
      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1 print:gap-3">
        {clusterResults.map((r) => (
          <ClusterCard key={r.cluster.id} result={r} />
        ))}
      </div>

      {/* Disclaimer */}
      <DisclaimerBlock suppliers={suppliers} />

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .container { padding: 0 !important; max-width: 100% !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </>
  );
}

interface ClusterResult {
  cluster: ConsumerCluster;
  rankedLuce: OfferRanking[];
  rankedGas: OfferRanking[];
  placetLuce: number;
  placetGas: number;
  placetTotal: number;
}

function ClusterCard({ result }: { result: ClusterResult }) {
  const { cluster, rankedLuce, rankedGas, placetTotal } = result;
  const winnerLuce = rankedLuce[0];
  const winnerGas = rankedGas[0];
  const mlTotal = (winnerLuce?.totalAnnualCostEur ?? 0) + (winnerGas?.totalAnnualCostEur ?? 0);
  const savings = placetTotal - mlTotal;
  const savingsPct = placetTotal > 0 ? (savings / placetTotal) * 100 : 0;

  return (
    <article className="bg-white rounded-xl border border-stone-200 p-5 space-y-4 print:break-inside-avoid print:border-stone-400">
      {/* Header cluster */}
      <header className="flex items-start gap-3 border-b border-stone-200 pb-3">
        <div className="text-3xl print:text-2xl" aria-hidden>{cluster.icon}</div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-stone-900">{cluster.label}</h2>
          <p className="text-xs text-stone-500">{cluster.description}</p>
          <p className="text-xs text-stone-700 mt-1">
            Consumo: <strong>{NUM.format(cluster.kwhAnno)} kWh</strong>
            {cluster.smcAnno > 0 && <> + <strong>{NUM.format(cluster.smcAnno)} Smc</strong></>}/anno
          </p>
        </div>
      </header>

      {/* Best ML offers */}
      <div className="space-y-2">
        {winnerLuce && (
          <OfferRow
            label="Migliore luce"
            commodity="kWh"
            ranking={winnerLuce}
          />
        )}
        {winnerGas && (
          <OfferRow
            label="Migliore gas"
            commodity="Smc"
            ranking={winnerGas}
          />
        )}
      </div>

      {/* Comparison block */}
      <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 space-y-2 print:bg-white">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-stone-900">Mercato libero</span>
          <span className="font-bold tabular-nums text-emerald-700">{EUR.format(mlTotal)}/anno</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-stone-600">PLACET ARERA (riferimento)</span>
          <span className="tabular-nums text-stone-700">{EUR.format(placetTotal)}/anno</span>
        </div>
        {savings > 0 && (
          <div className="text-xs text-emerald-700 pt-1 border-t border-stone-200 italic">
            ⚠️ Risparmio teorico {EUR.format(savings)} ({savingsPct.toFixed(0)}%). NB: ML = solo commodity, PLACET include accise/oneri. Vedi disclaimer.
          </div>
        )}
      </div>
    </article>
  );
}

function OfferRow({ label, commodity, ranking }: { label: string; commodity: string; ranking: OfferRanking }) {
  return (
    <div className="text-xs space-y-0.5">
      <div className="flex items-baseline justify-between">
        <span className="text-stone-500 uppercase tracking-wide">{label}</span>
        <span className="tabular-nums font-semibold text-stone-900">
          {EUR.format(ranking.totalAnnualCostEur)}/anno
        </span>
      </div>
      <div className="flex items-baseline justify-between text-stone-700">
        <span className="font-medium truncate pr-2">{ranking.offer.supplier} · {ranking.offer.offer_name ?? "—"}</span>
        <span className="text-stone-500">
          {ranking.offer.price_type === "fisso" ? "fisso" : "var"} · {ranking.effectivePriceEurPerUnit.toFixed(4)} €/{commodity}
          {(ranking.offer.fixed_cost_monthly ?? 0) > 0 && (
            <> + {ranking.offer.fixed_cost_monthly?.toFixed(0)}€/mese</>
          )}
        </span>
      </div>
    </div>
  );
}

function DisclaimerBlock({ suppliers }: { suppliers: string[] }) {
  return (
    <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-2 text-xs text-stone-700 print:bg-white print:border-stone-400">
      <h3 className="font-semibold text-stone-900 uppercase tracking-wide text-xs">⚠️ Disclaimer</h3>
      <ul className="space-y-1.5">
        <li>
          <strong>Brand coperti</strong>: il confronto include attualmente <strong>{suppliers.join(", ")}</strong>. Mancano alcuni brand del mercato libero italiano (es. Enel Energia, Eni Plenitude, A2A, Sorgenia, Iren) — verranno aggiunti con l&apos;estensione dell&apos;API EnergiaPro o tramite scraping.
        </li>
        <li>
          <strong>Mercato libero</strong>: i prezzi mostrati sono <strong>solo commodity</strong> (PUN/PSV + spread per le variabili; prezzo commodity bloccato per le fisse) + il costo commercializzazione mensile. <strong>Non includono</strong> accise, oneri di sistema, dispacciamento, distribuzione, IVA: aggiungere ~+0,10 €/kWh (luce) o ~+0,30 €/Smc (gas) + 22% IVA per stimare la bolletta finale.
        </li>
        <li>
          <strong>PLACET ARERA</strong>: tariffa regolata standard, riportata come riferimento. Il prezzo PLACET <strong>include tutti gli oneri</strong> (commodity + dispacciamento + oneri di sistema + accise + componente vendita). Non e&apos; quindi direttamente confrontabile con il mercato libero in termini di prezzo unitario, ma rappresenta un benchmark utile sul costo totale annuo.
        </li>
        <li>
          <strong>Forecast variabile</strong>: per le offerte a prezzo variabile, il calcolo usa il forecast PUN/PSV medio a 90 giorni (modello Ridge v1.0). Il valore effettivo dipendera&apos; dall&apos;andamento reale del mercato.
        </li>
        <li>
          <strong>Limitazioni</strong>: non sono considerati eventuali sconti promozionali, bundle luce+gas, fedelta&apos;, condizioni di pagamento e penali di recesso. Verificare sempre le condizioni sul sito del fornitore prima di sottoscrivere.
        </li>
      </ul>
      <p className="pt-2 border-t border-amber-200 text-stone-500 italic">
        Dati aggiornati al {new Date().toLocaleDateString("it-IT")}. Demo pubblica EIDX Pro — funzioni avanzate disponibili sui piani a pagamento.
      </p>
    </section>
  );
}
