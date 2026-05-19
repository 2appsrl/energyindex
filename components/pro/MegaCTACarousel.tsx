"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp, Users, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Mega CTA carousel: dark-green hero cards che ruotano automaticamente,
 * ognuna pubblicizza un tool diverso del Marketing Desk con stile pitch
 * "live demo · gratis · zero registrazione".
 *
 * - Auto-advance ogni 7 secondi (pause on hover)
 * - Navigation: dot indicators + prev/next arrows
 * - Smooth fade transition tra slide
 * - Tutti i link sono Next/Link per client-side navigation veloce
 */

interface CarouselSlide {
  id: string;
  title: string;
  titleAccent: string; // ultima parola colorata in emerald-300
  icon: LucideIcon;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  ctaIcon?: string; // emoji o simbolo prima del label
}

const SLIDES: CarouselSlide[] = [
  {
    id: "margin",
    icon: TrendingUp,
    title: "Prova il Margin Simulator",
    titleAccent: "adesso",
    description:
      "Sposta gli slider e vedi margine, LTV e posizionamento competitor ricalcolarsi in tempo reale. Confronta contratto variabile e fisso. Stressa 4 scenari di mercato. 60 secondi di tour guidato dentro.",
    features: [
      "Forecast PUN 12 mesi con banda 5–95%",
      "Benchmark su ~500 offerte ARERA live",
      "Variabile passthrough vs Fisso lock-in",
      "What-if custom: volume, costo, churn",
    ],
    ctaLabel: "Apri il simulatore",
    ctaHref: "/it/pro/simulator",
    ctaIcon: "▶",
  },
  {
    id: "customer",
    icon: Users,
    title: "Trova l'offerta giusta per ogni",
    titleAccent: "cliente",
    description:
      "Sposta consumo luce e gas: il ranking di tutte le offerte mercato libero attive si ricalcola in tempo reale. Best offer + alternative, costo bolletta totale stimato, comparazione fisso vs variabile.",
    features: [
      "Ranking real-time su tutte le offerte attive",
      "Best offer + Top 3 alternative",
      "Bolletta annua + mensile stimata",
      "Cluster preset pronti (PMI, famiglia, HORECA)",
    ],
    ctaLabel: "Apri Customer Simulator",
    ctaHref: "/it/pro/customer-simulator",
    ctaIcon: "▶",
  },
  {
    id: "churn",
    icon: AlertTriangle,
    title: "Predici quali clienti stanno per",
    titleAccent: "perderti",
    description:
      "Inserisci profilo cliente + offerta attuale: il modello calcola la probabilita' di churn nei prossimi 90 giorni con driver explanation. Per ogni cliente high-risk, azioni consigliate ranked per ROI.",
    features: [
      "Gauge probabilita' + 4 risk level",
      "Top 5 driver con contribution share",
      "Azioni consigliate ranked per ROI",
      "Calibrato su literature retail energy IT",
    ],
    ctaLabel: "Apri Churn Predictor",
    ctaHref: "/it/pro/marketing?tab=churn",
    ctaIcon: "▶",
  },
];

const AUTO_ADVANCE_MS = 7000;

export function MegaCTACarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % SLIDES.length);
  }, []);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  }, []);

  const goTo = useCallback((i: number) => {
    setActiveIndex(i);
  }, []);

  // Auto-advance
  useEffect(() => {
    if (isPaused) return;
    const id = window.setTimeout(next, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [activeIndex, isPaused, next]);

  const slide = SLIDES[activeIndex];

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Tool Marketing in evidenza"
    >
      <Link
        href={slide.ctaHref}
        className="group relative block overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a3d2e] via-[#0f5239] to-[#0a3d2e] p-8 sm:p-12 shadow-2xl shadow-emerald-900/20 transition-all hover:shadow-emerald-900/40 hover:-translate-y-1 ring-1 ring-emerald-400/10"
        aria-roledescription="slide"
        aria-label={`Slide ${activeIndex + 1} di ${SLIDES.length}: ${slide.title} ${slide.titleAccent}`}
      >
        {/* Decorative glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -bottom-20 h-60 w-60 rounded-full bg-amber-400/10 blur-3xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" aria-hidden />
              Live demo · gratis · zero registrazione
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              {slide.title} <span className="text-emerald-300">{slide.titleAccent}</span>
            </h2>
            <p className="text-base md:text-lg text-emerald-50/90 max-w-xl">
              {slide.description}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-emerald-50/80">
              {slide.features.map((f) => (
                <li key={f} className="flex items-baseline gap-2">
                  <span className="text-emerald-300 mt-0.5" aria-hidden>
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-shrink-0 flex flex-col items-stretch lg:items-end gap-3">
            <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-400 px-8 py-5 text-base md:text-lg font-bold text-emerald-950 shadow-xl shadow-emerald-500/30 transition-all group-hover:scale-[1.03] group-hover:shadow-emerald-500/50">
              {slide.ctaIcon && (
                <span aria-hidden className="text-xl">
                  {slide.ctaIcon}
                </span>
              )}
              {slide.ctaLabel}
              <span aria-hidden className="ml-1">
                →
              </span>
            </span>
            <p className="text-xs text-emerald-200/70 text-center lg:text-right">
              Funziona da browser · niente download · niente login
            </p>
          </div>
        </div>
      </Link>

      {/* Prev/Next arrows (desktop) */}
      <button
        type="button"
        onClick={prev}
        aria-label="Slide precedente"
        className="absolute left-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center justify-center h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Slide successiva"
        className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center justify-center h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>

      {/* Dot indicators */}
      <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Slide carousel">
        {SLIDES.map((s, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              role="tab"
              aria-selected={isActive}
              aria-controls="carousel-slide"
              aria-label={`Vai a slide ${i + 1}: ${s.title}`}
              className={`h-2 rounded-full transition-all ${
                isActive
                  ? "w-8 bg-emerald-600"
                  : "w-2 bg-stone-300 hover:bg-stone-400"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
