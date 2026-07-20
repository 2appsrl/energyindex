"use client";

import Link from "next/link";
import { Globe, Zap, Flame, ExternalLink } from "lucide-react";
import { DemoLockBanner } from "./DemoLockBanner";

/**
 * Market Offers tab del Marketing Desk → Pricing & Strategy group.
 * Non e' un tool nuovo, ma un punto di ingresso brandizzato verso le 2
 * mappe del mercato libero gia' esistenti (/mercato-libero/ticker), che
 * vivono fuori dalla dashboard Pro perche' hanno il proprio theme dark
 * full-screen.
 *
 * Da qui il pricing team accede al benchmark competitor live senza dover
 * cercare la rotta /mercato-libero.
 */
export function MarketOffersView() {
  return (
    <div className="space-y-4">
      <DemoLockBanner
        icon={Globe}
        title="Market Map: visualizzazione live di tutte le offerte mercato libero italiano."
        description="Demo include accesso completo alle mappe Market Map (open data ARERA + scraping commerciale). Tier Pro 499€/mese: export CSV delle offerte filtrate, alert su nuove offerte sotto soglia, API access programmatico."
      />

      <section className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-stone-900">
            Visualizza la concorrenza in tempo reale
          </h2>
          <p className="text-sm text-stone-600 max-w-2xl">
            Due viste interattive del mercato libero italiano, aggiornate
            giornalmente. Usa il benchmark per calibrare Dynamic Pricing,
            Margin Simulator e Customer Simulator.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Mercato Libero non-PLACET (Hera, Edison, Acea, Engie, Smart Energy) */}
          <MarketMapCard
            icon={Zap}
            badge="Mercato libero non-PLACET"
            title="Brand commerciali"
            description="Offerte commerciali dei 5 maggiori brand italiani (Hera Comm, Edison, Acea Energia, Engie, Smart Energy). Aggiornate via scraping diretto + EnergiaPro API."
            stats={[
              { label: "Brand monitorati", value: "5" },
              { label: "Aggiornamento", value: "Giornaliero" },
              { label: "Tipo dati", value: "Listini live" },
            ]}
            href="/it/mercato-libero/ticker?src=libero"
            accent="emerald"
          />

          {/* PLACET ARERA */}
          <MarketMapCard
            icon={Flame}
            badge="PLACET ARERA"
            title="Universo PLACET completo"
            description="Tutte le 1.500+ offerte PLACET pubblicate dal Portale Offerte ARERA. Open data ufficiale, copertura totale del mercato regolato."
            stats={[
              { label: "Offerte attive", value: "1.500+" },
              { label: "Fornitori", value: "100+" },
              { label: "Fonte", value: "ARERA open data" },
            ]}
            href="/it/mercato-libero/ticker?src=placet"
            accent="amber"
          />
        </div>

        <p className="text-xs text-stone-500 pt-2">
          Le mappe si aprono in una vista full-screen dedicata con tema dark.
          Usa il back del browser per tornare al Marketing Desk.
        </p>
      </section>

      {/* Use cases section */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-stone-900">Quando usarlo</h3>
        <ul className="grid gap-3 sm:grid-cols-3 text-sm">
          <UseCase
            title="Pricing review settimanale"
            body="Confronta il tuo listino vs P25/median/P75 del mercato per ogni cluster. Identifica zone di under-pricing o premium pricing."
          />
          <UseCase
            title="Benchmark pre-pitch"
            body="Prima di una call con un grande cliente, controlla cosa offrono i competitor sul suo profilo di consumo."
          />
          <UseCase
            title="Monitoraggio nuove offerte"
            body="Vedi quando un competitor lancia una promo aggressiva e adatta la tua risposta commerciale."
          />
        </ul>
      </section>
    </div>
  );
}

// ============================================================
// MARKET MAP CARD (preview + CTA)
// ============================================================

function MarketMapCard({
  icon: Icon,
  badge,
  title,
  description,
  stats,
  href,
  accent,
}: {
  icon: typeof Globe;
  badge: string;
  title: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
  href: string;
  accent: "emerald" | "amber";
}) {
  const accentClasses =
    accent === "emerald"
      ? {
          border: "border-emerald-300/50 hover:border-emerald-500",
          chip: "bg-emerald-100 text-emerald-800",
          iconBg: "bg-emerald-50 text-emerald-700",
          cta: "bg-emerald-600 hover:bg-emerald-500 text-white",
          shadow: "hover:shadow-emerald-500/10",
        }
      : {
          border: "border-amber-300/50 hover:border-amber-500",
          chip: "bg-amber-100 text-amber-800",
          iconBg: "bg-amber-50 text-amber-700",
          cta: "bg-amber-600 hover:bg-amber-500 text-white",
          shadow: "hover:shadow-amber-500/10",
        };

  return (
    <Link
      href={href}
      className={`group flex flex-col gap-4 rounded-2xl border-2 bg-white p-5 transition-all hover:shadow-lg ${accentClasses.border} ${accentClasses.shadow}`}
    >
      <header className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentClasses.iconBg} transition-all group-hover:scale-110`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${accentClasses.chip}`}
          >
            {badge}
          </span>
          <h3 className="text-lg font-bold text-stone-900 mt-1">{title}</h3>
        </div>
      </header>

      <p className="text-sm text-stone-600 flex-1">{description}</p>

      <dl className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-200">
        {stats.map((s) => (
          <div key={s.label}>
            <dd className="text-base font-bold tabular-nums text-stone-900">{s.value}</dd>
            <dt className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
              {s.label}
            </dt>
          </div>
        ))}
      </dl>

      <span
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${accentClasses.cta} group-hover:scale-[1.02]`}
      >
        Apri Market Map
        <ExternalLink className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}

function UseCase({ title, body }: { title: string; body: string }) {
  return (
    <li className="space-y-1">
      <h4 className="font-bold text-sm text-stone-900">{title}</h4>
      <p className="text-xs text-stone-600">{body}</p>
    </li>
  );
}
