"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Flame, Zap } from "lucide-react";

/**
 * "Market pulse" — ambient procedurale via Web Audio API per la pagina
 * Market Map. Niente asset esterno, tutto sintetizzato in-browser.
 *
 * Struttura sonora:
 * - Pad armonico in Do minore (C2 + E♭3 + G3) attraverso lowpass con LFO 0.05 Hz
 *   → atmosfera contemplativa, "respiro" lento
 * - Heartbeat kick ogni 750 ms (sub-bass 80→30 Hz envelope) → "il mercato e' vivo"
 * - Data ticks square wave 4-6 kHz random → "transazioni in corso"
 * - Ping pentatonici random ogni 5-15 s → "deal confermato"
 *
 * Ritorna handle con stop() che fade-out 0.4s + cleanup oscillatori.
 * Richiede user gesture (browser blocca autoplay senza interazione).
 */
function startMarketAmbient(): { stop: () => void; resume: () => void } {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AC();
  void ctx.resume();

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 1.5);

  // -- Pad armonico Do minore: C2 / E♭3 / G3 --
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = 800;
  padFilter.Q.value = 5;
  padFilter.connect(master);

  const padOscs: OscillatorNode[] = [];
  const padFreqs = [65.41, 155.56, 196.0];
  for (const freq of padFreqs) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0.04;
    osc.connect(g).connect(padFilter);
    osc.start();
    padOscs.push(osc);
  }

  // LFO sweep filtro (apre/chiude lentamente)
  const sweep = ctx.createOscillator();
  sweep.frequency.value = 0.05;
  const sweepGain = ctx.createGain();
  sweepGain.gain.value = 450;
  sweep.connect(sweepGain).connect(padFilter.frequency);
  sweep.start();

  // -- Heartbeat kick @ ~80 bpm (750 ms) --
  const playKick = () => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(80, t0);
    osc.frequency.exponentialRampToValueAtTime(30, t0 + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.16, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  };
  const kickTimer = setInterval(playKick, 750);

  // -- Data ticks square 4-6 kHz random --
  let tickTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleTick = () => {
    tickTimer = setTimeout(
      () => {
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = 4000 + Math.random() * 2000;
        const g = ctx.createGain();
        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.012, t0 + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
        osc.connect(g).connect(master);
        osc.start(t0);
        osc.stop(t0 + 0.05);
        scheduleTick();
      },
      300 + Math.random() * 1700,
    );
  };
  scheduleTick();

  // -- Ping pentatonici Do minore: confirm deal --
  let pingTimer: ReturnType<typeof setTimeout> | null = null;
  const PING_NOTES = [261.6, 311.1, 349.2, 392, 466.2, 523.2];
  const schedulePing = () => {
    pingTimer = setTimeout(
      () => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value =
          PING_NOTES[Math.floor(Math.random() * PING_NOTES.length)];
        const g = ctx.createGain();
        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.05, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
        osc.connect(g).connect(master);
        osc.start(t0);
        osc.stop(t0 + 1.3);
        schedulePing();
      },
      5000 + Math.random() * 10000,
    );
  };
  schedulePing();

  return {
    stop: () => {
      clearInterval(kickTimer);
      if (tickTimer) clearTimeout(tickTimer);
      if (pingTimer) clearTimeout(pingTimer);
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.4);
      setTimeout(() => {
        try {
          for (const osc of padOscs) osc.stop();
          sweep.stop();
          void ctx.close();
        } catch {
          /* ignore — oscillators may have already stopped */
        }
      }, 500);
    },
    resume: () => {
      // Browser blocca autoplay senza user gesture: il context parte
      // "suspended" e ctx.resume() puo' fallire silently fino al primo click.
      void ctx.resume();
    },
  };
}

export interface Offer {
  codice: string;
  vendor: string;
  commodity: "electricity" | "gas";
  priceType: "fisso" | "variabile";
  price: number;
  median: number;
  /**
   * PCV annuale (Prezzo per la Commercializzazione della Vendita), EUR/anno.
   * E' la quota fissa €/POD (luce) o €/PdR (gas) che si paga indipendentemente
   * dal consumo. Per calcolo bolletta totale: pcvEurAnno + price × consumo.
   * 0 se non disponibile (la RPC fa COALESCE su NULL).
   */
  pcvEurAnno: number;
  /**
   * Ruolo del creator su energiapro.biz (solo per source 'energiapro_commerciali').
   * NULL/undefined per PLACET (sempre certificate via ARERA) e per offerte legacy.
   */
  creatorRole?: "superadmin" | "admin" | "agency" | null;
  /** Tag della fonte: 'arera_placet', 'energiapro_commerciali', ecc. */
  source?: string | null;
}

/**
 * Una offerta e' "Certificate" (= validata, sicura) se:
 *  - viene da PLACET ARERA (open data ufficiale, sempre validate)
 *  - oppure proviene da energiapro.biz creata da superadmin (team interno)
 *
 * Altrimenti e' "Non certificate" (creata da agency/admin partner —
 * l'offerta esiste ma non e' ancora stata validata dal team).
 */
export function isCertificateOffer(o: Offer): boolean {
  if (o.source !== "energiapro_commerciali") return true;
  return o.creatorRole === "superadmin";
}

export type CertFilter = "all" | "cert" | "non-cert";

/**
 * Modalita' di ordinamento dei tile dentro ogni sezione (commodity x priceType).
 *  - "price"   : prezzo unitario / spread (€/kWh, €/Smc) — il default storico
 *  - "pcv"     : Costo Commercializzazione Annuo (€/anno fisso indipendente
 *                dal consumo); PCV=0 (dato mancante) viene spinto in fondo
 *  - "consumo" : bolletta annua stimata sul consumo del Customer Simulator
 *                (pcv + price × volume + proxy spot per variabili); offerte
 *                con PCV=0 vanno in fondo (stesso criterio del simulator)
 */
export type SortMode = "price" | "pcv" | "consumo";

/**
 * Calcola il costo commodity annuo per una offerta dato il consumo.
 * Condiviso con MarketMapSimulator: stessa formula per ordinamento "consumo"
 * e per il calcolo del winner sotto la mappa.
 *
 * Formula: pcvEurAnno + unitPrice × volume.
 * Per offerte VARIABILI aggiungiamo proxy spot (PUN/PSV) — altrimenti uno
 * spread di 0.02 €/kWh "batterebbe" un fisso di 0.20 €/kWh, sbagliato.
 */
export function annualCommodityCost(offer: Offer, volume: number): number {
  const SPOT_LUCE = 0.10; // €/kWh proxy PUN 2026
  const SPOT_GAS = 0.35; // €/Smc proxy PSV 2026
  let unitPrice = offer.price;
  if (offer.priceType === "variabile") {
    unitPrice += offer.commodity === "electricity" ? SPOT_LUCE : SPOT_GAS;
  }
  return offer.pcvEurAnno + unitPrice * volume;
}

/**
 * Una offerta arricchita con la metrica attiva (= dimensione valutata dal
 * sortMode corrente: prezzo, PCV o bolletta annua). Computata una volta
 * per offer dentro la sezione, riusata per sort + color.
 */
interface OfferWithMetric {
  offer: Offer;
  /** Valore della metrica attiva. Number.POSITIVE_INFINITY se non
   *  disponibile (es. PCV=0 in modalita' pcv/consumo). */
  metric: number;
}

interface Section {
  key: string;
  title: string;
  icon: ReactNode;
  /** Unita' della metrica attiva: €/kWh, €/Smc, €/anno. */
  metricUnit: string;
  /** Per il prezzo unitario delle variabili anteponiamo "+" (e' uno spread);
   *  per PCV e consumo no (sono valori assoluti). */
  metricUsesSpreadPrefix: boolean;
  /** Etichetta breve della metrica, mostrata nell'header sezione. */
  metricLabel: string;
  /** Mediana della metrica sulle offerte con valore finito (non-Infinity).
   *  Usata da colorForDelta per stabilire verde/giallo/rosso. */
  medianMetric: number;
  bestMetric: number;
  worstMetric: number;
  /** Numero di offerte senza dato metrica (es. PCV=0 in modalita' pcv). */
  missingDataCount: number;
  offers: OfferWithMetric[];
}

const LUCE_ICON = (
  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40 shadow-[0_0_10px_rgba(20,217,122,0.35)]">
    <Zap className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
  </span>
);
const GAS_ICON = (
  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.35)]">
    <Flame className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
  </span>
);

const NUMBER_4DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const NUM_IT = new Intl.NumberFormat("it-IT");
// Per metriche in €/anno (PCV, bolletta totale): formato intero.
const EUR_INT_HEADER = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 0,
});

/**
 * Colore tile dato il delta di una metrica generica rispetto alla sua
 * mediana di sezione. Verde = molto meglio della mediana, rosso = molto
 * peggio. Soglie ±10%, ±30% sono le stesse di prima — invariata
 * per il prezzo, ora applicata anche a PCV e bolletta totale.
 */
function colorForDelta(value: number, median: number): { fill: string; glow: string } {
  if (median <= 0 || !Number.isFinite(value)) {
    return { fill: "#facc15", glow: "rgba(250,204,21,0.4)" };
  }
  const delta = (value - median) / median;
  if (delta < -0.3) return { fill: "#14d97a", glow: "rgba(20, 217, 122, 0.8)" };
  if (delta < -0.1) return { fill: "#10b981", glow: "rgba(16, 185, 129, 0.5)" };
  if (delta < 0.1) return { fill: "#facc15", glow: "rgba(250, 204, 21, 0.5)" };
  if (delta < 0.3) return { fill: "#fb923c", glow: "rgba(251, 146, 60, 0.6)" };
  return { fill: "#f43f5e", glow: "rgba(244, 63, 94, 0.8)" };
}

/** Colore neutro grigio per offerte senza dato metrica (es. PCV=0). */
const MISSING_DATA_COLOR = {
  fill: "#4b5563",
  glow: "rgba(75, 85, 99, 0.4)",
};

/**
 * Valore metrica per una offerta data la modalita' attiva.
 * Driver UNICO sia per il sort (chiave di ordinamento) sia per il color
 * (delta vs mediana di sezione). Cosi' "in alto" e "verde" sono sempre
 * la stessa cosa sotto la lente del sortMode scelto.
 *
 * Number.POSITIVE_INFINITY = dato mancante:
 *  - pcv/consumo + PCV=0 → l'offerta non ha quota fissa valida nei dati
 *  - sort: va in fondo
 *  - color: grigio neutro (non distorce la mediana, non viene contata)
 */
function metricFor(o: Offer, mode: SortMode, volume: number): number {
  switch (mode) {
    case "price":
      return o.price;
    case "pcv":
      return o.pcvEurAnno > 0 ? o.pcvEurAnno : Number.POSITIVE_INFINITY;
    case "consumo":
      if (o.pcvEurAnno <= 0) return Number.POSITIVE_INFINITY;
      return annualCommodityCost(o, volume);
  }
}

/** Mediana di un array di numeri finiti. Ritorna 0 su array vuoto. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function metricMeta(mode: SortMode): {
  label: string;
  unitFor: (sectionUnit: string) => string;
  usesSpreadPrefix: (sectionIsSpread: boolean) => boolean;
} {
  switch (mode) {
    case "price":
      return {
        label: "PREZZO",
        unitFor: (u) => u, // €/kWh o €/Smc
        usesSpreadPrefix: (isSpread) => isSpread, // "+" davanti per gli spread
      };
    case "pcv":
      return {
        label: "PCV",
        unitFor: () => "€/anno",
        usesSpreadPrefix: () => false,
      };
    case "consumo":
      return {
        label: "BOLLETTA",
        unitFor: () => "€/anno",
        usesSpreadPrefix: () => false,
      };
  }
}

function groupOffers(
  offers: Offer[],
  sortMode: SortMode,
  kwhAnno: number,
  smcAnno: number,
): Section[] {
  const groups = new Map<string, Offer[]>();
  for (const o of offers) {
    const key = `${o.commodity}_${o.priceType}`;
    const arr = groups.get(key) ?? [];
    arr.push(o);
    groups.set(key, arr);
  }
  const meta = metricMeta(sortMode);
  const sectionDefs = [
    { key: "electricity_fisso", title: "LUCE FISSA", icon: LUCE_ICON, unit: "€/kWh", isSpread: false },
    { key: "electricity_variabile", title: "LUCE VARIABILE (spread)", icon: LUCE_ICON, unit: "€/kWh", isSpread: true },
    { key: "gas_fisso", title: "GAS FISSA", icon: GAS_ICON, unit: "€/Smc", isSpread: false },
    { key: "gas_variabile", title: "GAS VARIABILE (spread)", icon: GAS_ICON, unit: "€/Smc", isSpread: true },
  ];

  return sectionDefs.map((def) => {
    const rawOffers = groups.get(def.key) ?? [];
    const vol = def.key.startsWith("electricity") ? kwhAnno : smcAnno;

    const enriched: OfferWithMetric[] = rawOffers.map((o) => ({
      offer: o,
      metric: metricFor(o, sortMode, vol),
    }));
    enriched.sort((a, b) => a.metric - b.metric);

    const finiteMetrics: number[] = [];
    let missing = 0;
    for (const e of enriched) {
      if (Number.isFinite(e.metric)) finiteMetrics.push(e.metric);
      else missing++;
    }
    const bestMetric = finiteMetrics.length > 0 ? finiteMetrics[0] : 0;
    const worstMetric =
      finiteMetrics.length > 0 ? finiteMetrics[finiteMetrics.length - 1] : 0;
    const medianMetric = median(finiteMetrics);

    return {
      key: def.key,
      title: def.title,
      icon: def.icon,
      metricUnit: meta.unitFor(def.unit),
      metricUsesSpreadPrefix: meta.usesSpreadPrefix(def.isSpread),
      metricLabel: meta.label,
      medianMetric,
      bestMetric,
      worstMetric,
      missingDataCount: missing,
      offers: enriched,
    } satisfies Section;
  });
}

export function MarketMap({
  offers,
  asOf,
  source = "all",
  highlightedCodes,
  sortMode,
  onSortModeChange,
  kwhAnno,
  smcAnno,
}: {
  offers: Offer[];
  asOf: string | null;
  source?: "all" | "placet" | "libero";
  /**
   * Codici di offerte da evidenziare visivamente con glow extra (winner
   * del MarketMapSimulator sotto la mappa). Pass-by-value via array di
   * stringhe — viene convertito in Set internamente per O(1) lookup.
   */
  highlightedCodes?: string[];
  /** Modalita' di ordinamento dei tile (controlled dal wrapper). */
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  /** Consumi correnti del simulator — usati solo se sortMode='consumo'. */
  kwhAnno: number;
  smcAnno: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<{
    offer: Offer;
    metric: number;
    section: Section;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const comboRef = useRef<HTMLDivElement>(null);
  // Filtro Certificate / Non certificate: default "all" mostra tutte le offerte.
  // Visibile solo nel source=libero (PLACET sono sempre certificate, filtro inutile).
  const [certFilter, setCertFilter] = useState<CertFilter>("all");

  // Conta offerte per badge nelle chip
  const certCount = useMemo(
    () => offers.filter((o) => isCertificateOffer(o)).length,
    [offers],
  );
  const nonCertCount = offers.length - certCount;
  // Audio default ON: ma il browser blocca autoplay senza user gesture.
  // Strategia: ritardiamo la creazione dell'AudioContext fino al primo
  // gesto utente (hasInteracted), poi parte subito.
  const [audioOn, setAudioOn] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioHandleRef = useRef<{ stop: () => void; resume: () => void } | null>(null);

  // Detect prima interazione utente (qualsiasi click/keypress/touch).
  useEffect(() => {
    if (hasInteracted) return;
    const markInteracted = () => setHasInteracted(true);
    const opts = { once: true } as const;
    document.addEventListener("pointerdown", markInteracted, opts);
    document.addEventListener("keydown", markInteracted, opts);
    document.addEventListener("touchstart", markInteracted, opts);
    return () => {
      document.removeEventListener("pointerdown", markInteracted);
      document.removeEventListener("keydown", markInteracted);
      document.removeEventListener("touchstart", markInteracted);
    };
  }, [hasInteracted]);

  // Avvia/ferma audio quando lo stato cambia. La creazione dell'AudioContext
  // avviene SOLO dopo hasInteracted=true: a quel punto siamo dentro un
  // gesture handler (o subito dopo) e ctx.resume() funziona.
  useEffect(() => {
    if (!audioOn || !hasInteracted) {
      audioHandleRef.current?.stop();
      audioHandleRef.current = null;
      return;
    }
    const handle = startMarketAmbient();
    audioHandleRef.current = handle;
    handle.resume();
    return () => {
      handle.stop();
      audioHandleRef.current = null;
    };
  }, [audioOn, hasInteracted]);

  // Filter offers per Certificate/Non certificate prima di raggrupparle.
  // Nota: la median di categoria e' precalcolata server-side sull'universo
  // completo, cosi' il colore (delta vs median) resta coerente quando si
  // applica il filtro (non muta la mediana).
  const filteredOffers = useMemo(() => {
    if (certFilter === "all") return offers;
    if (certFilter === "cert") return offers.filter(isCertificateOffer);
    return offers.filter((o) => !isCertificateOffer(o));
  }, [offers, certFilter]);

  const sections = useMemo(
    () => groupOffers(filteredOffers, sortMode, kwhAnno, smcAnno),
    [filteredOffers, sortMode, kwhAnno, smcAnno],
  );

  // Set lookup O(1) per il tile-rendering. useMemo evita di ricreare il
  // Set ad ogni render se l'array highlightedCodes e' stabile.
  const highlightSet = useMemo(
    () => new Set(highlightedCodes ?? []),
    [highlightedCodes],
  );

  const distinctVendors = useMemo(() => {
    const set = new Set<string>();
    for (const o of offers) set.add(o.vendor);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "it"));
  }, [offers]);

  // Vendor filtrati per il combobox: top 12 match.
  const comboMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return distinctVendors.slice(0, 12);
    return distinctVendors
      .filter((v) => v.toLowerCase().includes(q))
      .slice(0, 12);
  }, [distinctVendors, search]);

  // Reset highlight quando cambia la lista.
  useEffect(() => {
    setHighlightedIdx(-1);
  }, [search]);

  // Chiudi combobox al click fuori.
  useEffect(() => {
    if (!comboOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [comboOpen]);

  const searchActive = search.trim().length > 0;
  const searchLower = search.trim().toLowerCase();
  const matchesSearch = (vendor: string) =>
    searchActive && vendor.toLowerCase().includes(searchLower);

  // Conta match
  const matchCount = useMemo(() => {
    if (!searchActive) return 0;
    return offers.filter((o) => matchesSearch(o.vendor)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers, searchActive, searchLower]);

  // Matrix rain background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns)
      .fill(1)
      .map(() => Math.random() * -50);
    const chars =
      "01ABCDEFGHIJKLMNOPQRSTUVWXYZ€$≈+-↑↓0123456789kWhSmc".split("");

    let animationId = 0;
    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px JetBrains Mono, ui-monospace, monospace`;
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle =
          drops[i] < 5 ? "rgba(255,255,255,0.6)" : "rgba(20,217,122,0.32)";
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  let globalIndex = 0;
  const totalOffers = offers.length;

  if (offers.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-emerald-400 font-mono p-8 text-center">
        <div>
          <h1 className="text-2xl mb-2">MARKET MAP</h1>
          <p className="text-emerald-300/60">
            {source === "libero"
              ? "Dati in arrivo: la prima rilevazione dalle offerte commerciali (EnergiaPro + scraping brand) arrivera' al prossimo ciclo ETL."
              : "Dati in arrivo: la prima rilevazione ARERA arriverà al prossimo ETL."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black overflow-x-hidden">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none opacity-50"
        aria-hidden="true"
      />

      <div className="relative z-10 p-4 sm:p-8 max-w-[1600px] mx-auto">
        <header className="mb-6 border-b border-emerald-400/30 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-5xl font-bold text-emerald-400 font-mono tracking-wider">
                MARKET MAP
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-emerald-300/70 font-mono text-xs sm:text-sm">
                <span>{totalOffers} OFFERS</span>
                <span>·</span>
                <div className="flex items-center gap-2">
                  <Link
                    href="/it/mercato-libero/ticker"
                    aria-current={source === "all" ? "page" : undefined}
                    className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded transition-colors ${
                      source === "all"
                        ? "bg-emerald-300 text-black"
                        : "bg-transparent text-emerald-300/60 hover:text-emerald-300 border border-emerald-300/30"
                    }`}
                  >
                    Tutte
                  </Link>
                  <Link
                    href="/it/mercato-libero/ticker?src=placet"
                    aria-current={source === "placet" ? "page" : undefined}
                    className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded transition-colors ${
                      source === "placet"
                        ? "bg-emerald-300 text-black"
                        : "bg-transparent text-emerald-300/60 hover:text-emerald-300 border border-emerald-300/30"
                    }`}
                  >
                    PLACET
                  </Link>
                  <Link
                    href="/it/mercato-libero/ticker?src=libero"
                    aria-current={source === "libero" ? "page" : undefined}
                    className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded transition-colors ${
                      source === "libero"
                        ? "bg-emerald-300 text-black"
                        : "bg-transparent text-emerald-300/60 hover:text-emerald-300 border border-emerald-300/30"
                    }`}
                  >
                    Mercato libero
                  </Link>
                </div>
                <span>·</span>
                <span>{asOf ?? "—"}</span>
                {searchActive && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400 font-bold">
                      {matchCount} MATCH
                    </span>
                  </>
                )}
              </div>

              {/* Sort mode: 3 tastoni prominenti per scegliere l'ordinamento
                  delle tile. Default = "price" (storico). */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-[10px] uppercase tracking-widest text-emerald-300/50 font-mono">
                  Ordina per:
                </span>
                <button
                  type="button"
                  onClick={() => onSortModeChange("price")}
                  aria-pressed={sortMode === "price"}
                  title="Prezzo unitario in €/kWh o €/Smc (per le variabili e' lo spread sopra PUN/PSV)"
                  className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-widest transition-colors ${
                    sortMode === "price"
                      ? "bg-emerald-300 text-black shadow-[0_0_12px_rgba(20,217,122,0.5)]"
                      : "bg-transparent text-emerald-300/70 hover:text-emerald-300 border border-emerald-300/30"
                  }`}
                >
                  Costo Offerta
                </button>
                <button
                  type="button"
                  onClick={() => onSortModeChange("pcv")}
                  aria-pressed={sortMode === "pcv"}
                  title="Prezzo per la Commercializzazione della Vendita: quota fissa annua €/POD o €/PdR, indipendente dal consumo"
                  className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-widest transition-colors ${
                    sortMode === "pcv"
                      ? "bg-emerald-300 text-black shadow-[0_0_12px_rgba(20,217,122,0.5)]"
                      : "bg-transparent text-emerald-300/70 hover:text-emerald-300 border border-emerald-300/30"
                  }`}
                >
                  Costo Commercializzazione Annuo
                </button>
                <button
                  type="button"
                  onClick={() => onSortModeChange("consumo")}
                  aria-pressed={sortMode === "consumo"}
                  title="Bolletta annua stimata sul consumo del Customer Simulator (PCV + prezzo × consumo)"
                  className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-widest transition-colors ${
                    sortMode === "consumo"
                      ? "bg-emerald-300 text-black shadow-[0_0_12px_rgba(20,217,122,0.5)]"
                      : "bg-transparent text-emerald-300/70 hover:text-emerald-300 border border-emerald-300/30"
                  }`}
                >
                  Consumo Cliente
                </button>
                <span className="text-[10px] text-emerald-300/40 font-mono italic ml-1 hidden md:inline">
                  {sortMode === "price"
                    ? "Tile ordinati e colorati per €/kWh o €/Smc"
                    : sortMode === "pcv"
                      ? "Tile ordinati e colorati per quota fissa annua (€/anno)"
                      : `Tile ordinati e colorati per bolletta annua stimata su ${NUM_IT.format(kwhAnno)} kWh + ${NUM_IT.format(smcAnno)} Smc`}
                </span>
              </div>

              {/* Filtro Certificate / Non certificate
                  Visibile solo nella vista MERCATO LIBERO (PLACET sono
                  sempre certificate by ARERA, il filtro sarebbe inutile). */}
              {(source === "libero" || source === "all") && nonCertCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-[10px] uppercase tracking-widest text-emerald-300/50 font-mono">
                    Filtra:
                  </span>
                  <button
                    type="button"
                    onClick={() => setCertFilter("all")}
                    aria-pressed={certFilter === "all"}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest transition-colors ${
                      certFilter === "all"
                        ? "bg-emerald-300 text-black"
                        : "bg-transparent text-emerald-300/60 hover:text-emerald-300 border border-emerald-300/30"
                    }`}
                  >
                    Tutte {offers.length}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertFilter("cert")}
                    aria-pressed={certFilter === "cert"}
                    title="Offerte create da team interno energiapro e verificate"
                    className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest transition-colors inline-flex items-center gap-1 ${
                      certFilter === "cert"
                        ? "bg-emerald-300 text-black"
                        : "bg-transparent text-emerald-300/60 hover:text-emerald-300 border border-emerald-300/30"
                    }`}
                  >
                    <span aria-hidden>✓</span> Certificate {certCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertFilter("non-cert")}
                    aria-pressed={certFilter === "non-cert"}
                    title="Offerte create da agenzie partner, non ancora verificate dal team energiapro"
                    className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest transition-colors inline-flex items-center gap-1 ${
                      certFilter === "non-cert"
                        ? "bg-amber-300 text-black"
                        : "bg-transparent text-amber-300/60 hover:text-amber-300 border border-amber-300/30"
                    }`}
                  >
                    <span aria-hidden>⚠</span> Non certificate {nonCertCount}
                  </button>
                  <span className="text-[10px] text-emerald-300/40 font-mono italic ml-1 hidden md:inline">
                    {certFilter === "all"
                      ? "Mix: verificate + create da agenzie"
                      : certFilter === "cert"
                        ? "Solo offerte validate dal team"
                        : "Solo offerte da agenzie partner"}
                  </span>
                </div>
              )}
            </div>

            <div className="w-full sm:w-80 space-y-2">
              <div ref={comboRef} className="relative">
                <label
                  htmlFor="vendor-search"
                  className="block text-xs font-mono text-emerald-300/60 mb-1 uppercase tracking-wider"
                >
                  Cerca fornitore
                </label>
                <input
                  id="vendor-search"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setComboOpen(true);
                  }}
                  onFocus={() => setComboOpen(true)}
                  onKeyDown={(e) => {
                    if (!comboOpen) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedIdx((i) =>
                        Math.min(comboMatches.length - 1, i + 1),
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedIdx((i) => Math.max(0, i - 1));
                    } else if (e.key === "Enter") {
                      if (
                        highlightedIdx >= 0 &&
                        highlightedIdx < comboMatches.length
                      ) {
                        e.preventDefault();
                        setSearch(comboMatches[highlightedIdx]);
                        setComboOpen(false);
                      }
                    } else if (e.key === "Escape") {
                      setComboOpen(false);
                    }
                  }}
                  placeholder="Es. ENEL, EDISON, A2A…"
                  aria-label="Cerca fornitore"
                  aria-autocomplete="list"
                  aria-expanded={comboOpen}
                  aria-controls="vendor-combobox-list"
                  role="combobox"
                  className="w-full bg-black/80 border border-emerald-400/40 rounded px-3 py-2 text-emerald-200 placeholder:text-emerald-300/30 font-mono text-sm focus:outline-none focus:border-emerald-400 focus:shadow-[0_0_12px_rgba(20,217,122,0.5)] transition-shadow"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setComboOpen(false);
                    }}
                    aria-label="Cancella ricerca"
                    className="absolute right-2 top-[26px] text-emerald-300/50 hover:text-emerald-300 font-mono text-sm w-5 h-5 flex items-center justify-center"
                  >
                    ✕
                  </button>
                )}
                {comboOpen && comboMatches.length > 0 && (
                  <ul
                    id="vendor-combobox-list"
                    role="listbox"
                    className="absolute top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-black/95 border border-emerald-400/40 rounded shadow-[0_0_20px_rgba(20,217,122,0.3)] z-40 font-mono text-sm backdrop-blur-sm"
                  >
                    {comboMatches.map((v, i) => (
                      <li
                        key={v}
                        role="option"
                        aria-selected={i === highlightedIdx}
                        onMouseEnter={() => setHighlightedIdx(i)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearch(v);
                          setComboOpen(false);
                        }}
                        className={
                          i === highlightedIdx
                            ? "px-3 py-1.5 cursor-pointer bg-emerald-400/20 text-emerald-200 border-l-2 border-emerald-400"
                            : "px-3 py-1.5 cursor-pointer text-emerald-300/80 hover:bg-emerald-400/10 hover:text-emerald-200 border-l-2 border-transparent"
                        }
                      >
                        {v}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                onClick={() => setAudioOn((v) => !v)}
                aria-pressed={audioOn}
                aria-label={audioOn ? "Disattiva audio" : "Attiva audio"}
                className={`w-full font-mono text-xs uppercase tracking-wider rounded px-3 py-2 border transition-all flex items-center justify-center gap-2 ${
                  audioOn
                    ? "bg-emerald-400/10 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(20,217,122,0.4)]"
                    : "bg-black/80 border-emerald-400/40 text-emerald-300/70 hover:border-emerald-400 hover:text-emerald-300"
                }`}
              >
                <span
                  className={
                    audioOn
                      ? "inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                      : "inline-block w-2 h-2 rounded-full border border-emerald-400/60"
                  }
                  aria-hidden="true"
                />
                {audioOn ? "Audio ON" : "Audio OFF"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono">
            <span className="text-emerald-300/40 italic">
              Colori ={" "}
              {sortMode === "price"
                ? "Δ prezzo"
                : sortMode === "pcv"
                  ? "Δ PCV"
                  : "Δ bolletta annua stimata"}{" "}
              vs mediana sezione:
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{
                  background: "#14d97a",
                  boxShadow: "0 0 6px rgba(20,217,122,0.7)",
                }}
              />
              <span className="text-emerald-300/80">-30%+ vs mediana</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: "#10b981" }}
              />
              <span className="text-emerald-300/80">-30% .. -10%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: "#facc15" }}
              />
              <span className="text-emerald-300/80">mediana ±10%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: "#fb923c" }}
              />
              <span className="text-emerald-300/80">+10% .. +30%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{
                  background: "#f43f5e",
                  boxShadow: "0 0 6px rgba(244,63,94,0.7)",
                }}
              />
              <span className="text-emerald-300/80">+30% e oltre</span>
            </span>
            {sortMode !== "price" && (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: MISSING_DATA_COLOR.fill }}
                />
                <span
                  className="text-emerald-300/80"
                  title="Offerte con PCV=0 nel DB: non hanno la quota fissa annua tra i dati pubblicati"
                >
                  dato non disponibile
                </span>
              </span>
            )}
          </div>
        </header>

        <div className="space-y-10">
          {sections.map((section) => {
            if (section.offers.length === 0) return null;
            // MED/BEST/WORST nell'header riflettono la metrica attiva
            // (prezzo, PCV o bolletta annua) — calcolati su offerte con dato
            // disponibile (no PCV=0 nelle modalita' pcv/consumo).
            //
            // Formattazione metrica: prezzo unitario (4 decimali) vs
            // €/anno (intero, le bollette stimate sono dell'ordine di 100-2000 €).
            const formatMetric = (v: number) => {
              if (!Number.isFinite(v)) return "—";
              return section.metricUnit === "€/anno"
                ? EUR_INT_HEADER.format(v)
                : NUMBER_4DP.format(v);
            };
            const sign = section.metricUsesSpreadPrefix ? "+" : "";
            return (
              <section key={section.key}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-emerald-400/15 pb-2">
                  <h2 className="flex items-center gap-2 text-lg sm:text-xl font-mono font-bold text-emerald-300 tracking-wider">
                    {section.icon}
                    {section.title}
                  </h2>
                  <span className="font-mono text-xs sm:text-sm text-emerald-300/60 tabular-nums">
                    {section.offers.length} OFFERTE · {section.metricLabel} MED{" "}
                    {sign}
                    {formatMetric(section.medianMetric)} {section.metricUnit} · BEST{" "}
                    {sign}
                    {formatMetric(section.bestMetric)} · WORST{" "}
                    {sign}
                    {formatMetric(section.worstMetric)}
                    {section.missingDataCount > 0 && (
                      <span className="text-emerald-300/40 italic">
                        {" "}
                        · {section.missingDataCount} senza dato
                      </span>
                    )}
                  </span>
                </div>

                <div
                  className="grid gap-[3px]"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(22px, 1fr))",
                  }}
                >
                  {section.offers.map(({ offer: o, metric }) => {
                    const hasMetric = Number.isFinite(metric);
                    const { fill, glow } = hasMetric
                      ? colorForDelta(metric, section.medianMetric)
                      : MISSING_DATA_COLOR;
                    const idx = globalIndex++;
                    const isMatch = matchesSearch(o.vendor);
                    const isDimmed = searchActive && !isMatch;
                    const isNonCert = !isCertificateOffer(o);
                    const isWinner = highlightSet.has(o.codice);
                    const cls = [
                      "aspect-square rounded-[3px] cursor-pointer relative tile-fall focus:outline-none focus:ring-2 focus:ring-emerald-400",
                      isMatch ? "tile-pulse" : "",
                      isDimmed ? "tile-dim" : "",
                      isNonCert ? "ring-1 ring-inset ring-amber-200/70" : "",
                      // Winner del Simulator sotto la mappa: scale-up + ring extra
                      // pulse + z-elevation per "saltare fuori" dal grid.
                      isWinner
                        ? "tile-winner ring-2 ring-emerald-200 z-10 scale-[1.6]"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    const certLabel = isNonCert
                      ? " · NON CERTIFICATE (creata da agenzia)"
                      : "";
                    const winnerLabel = isWinner
                      ? " · MIGLIORE OFFERTA per il tuo consumo"
                      : "";
                    const ariaMetricValue = hasMetric
                      ? `${sign}${formatMetric(metric)} ${section.metricUnit}`
                      : "dato non disponibile";
                    return (
                      <button
                        key={o.codice}
                        type="button"
                        className={cls}
                        style={{
                          background: fill,
                          boxShadow: isWinner
                            ? `0 0 24px 4px ${glow}, 0 0 8px ${glow}`
                            : `0 0 6px ${glow}`,
                          animationDelay: `${idx * 3}ms`,
                          ["--glow" as string]: glow,
                        }}
                        onMouseEnter={() => setHovered({ offer: o, metric, section })}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered({ offer: o, metric, section })}
                        onBlur={() => setHovered(null)}
                        aria-label={`${o.vendor} ${ariaMetricValue}${certLabel}${winnerLabel}`}
                      >
                        {isNonCert && (
                          <span
                            aria-hidden
                            className="absolute -top-0.5 -right-0.5 text-[7px] leading-none text-amber-900 font-bold drop-shadow-[0_0_2px_rgba(0,0,0,0.6)]"
                          >
                            ⚠
                          </span>
                        )}
                        {isWinner && (
                          <span
                            aria-hidden
                            className="absolute -top-1 -left-1 text-[9px] leading-none drop-shadow-[0_0_3px_rgba(255,255,255,0.8)]"
                          >
                            🏆
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-12 text-center text-emerald-300/40 font-mono text-xs space-y-1">
          <p>
            {source === "libero"
              ? `ENERGY INDEX · MARKET MAP · OFFERTE COMMERCIALI MERCATO LIBERO (NON-PLACET) · ULTIMA RILEVAZIONE ${asOf ?? "—"}`
              : source === "placet"
                ? `ENERGY INDEX · MARKET MAP · DATI ARERA PORTALE OFFERTE PLACET · ULTIMA RILEVAZIONE ${asOf ?? "—"}`
                : `ENERGY INDEX · MARKET MAP · TUTTE LE OFFERTE (PLACET ARERA + MERCATO LIBERO) · ULTIMA RILEVAZIONE ${asOf ?? "—"}`}
          </p>
          <p>
            <Link href="/it/mercato-libero" className="hover:text-emerald-400">
              ← Torna all&apos;osservatorio
            </Link>
          </p>
        </footer>
      </div>

      {hovered && (() => {
        // Tooltip rifletta la metrica attiva (prezzo, PCV o bolletta).
        // PCV=0 in modalita' pcv/consumo → metric=Infinity → mostriamo
        // "dato non disponibile" invece del numero.
        const sign = hovered.section.metricUsesSpreadPrefix ? "+" : "";
        const formatMetric = (v: number) => {
          if (!Number.isFinite(v)) return "—";
          return hovered.section.metricUnit === "€/anno"
            ? EUR_INT_HEADER.format(v)
            : NUMBER_4DP.format(v);
        };
        const hasMetric = Number.isFinite(hovered.metric);
        const med = hovered.section.medianMetric;
        const deltaPct =
          hasMetric && med > 0
            ? ((hovered.metric - med) / med) * 100
            : null;
        return (
          <div
            aria-live="polite"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/95 border-2 border-emerald-400/60 text-emerald-300 font-mono px-6 py-3 rounded-lg backdrop-blur-md z-30 shadow-[0_0_30px_rgba(20,217,122,0.4)] pointer-events-none min-w-[280px] max-w-[90vw]"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-base sm:text-lg font-bold text-emerald-400 tracking-wider">
                {hovered.offer.vendor}
              </div>
              {isCertificateOffer(hovered.offer) ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 border border-emerald-300/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300"
                  title="Offerta verificata dal team energiapro"
                >
                  <span aria-hidden>✓</span> Certificate
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-300/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300"
                  title="Offerta creata da agenzia partner, non ancora verificata dal team"
                >
                  <span aria-hidden>⚠</span> Non certificate
                </span>
              )}
            </div>
            <div className="text-xs text-emerald-300/60 mb-2">
              {hovered.offer.codice} · {hovered.section.title} ·{" "}
              <span className="uppercase tracking-widest">
                {hovered.section.metricLabel}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tabular-nums">
              {hasMetric ? (
                <>
                  {sign}
                  {formatMetric(hovered.metric)}{" "}
                  <span className="text-sm font-normal text-emerald-300/70">
                    {hovered.section.metricUnit}
                  </span>
                </>
              ) : (
                <span className="text-base text-emerald-300/60 font-normal italic">
                  Dato non disponibile in questa modalita&apos;
                </span>
              )}
            </div>
            {deltaPct !== null && (
              <div className="text-xs text-emerald-300/70 tabular-nums mt-1">
                Δ vs mediana {sign}
                {formatMetric(med)}:{" "}
                <span
                  style={{
                    color:
                      deltaPct < -10
                        ? "#14d97a"
                        : deltaPct > 10
                          ? "#f43f5e"
                          : "#facc15",
                  }}
                >
                  {deltaPct > 0 ? "+" : ""}
                  {deltaPct.toFixed(1)}%
                </span>
              </div>
            )}
            {/* Sempre visibile: il prezzo unitario "originale" anche
                quando la metrica attiva e' un'altra — cosi' chi confronta
                via tooltip ha tutti i dati a colpo d'occhio. */}
            {sortMode !== "price" && (
              <div className="text-[10px] text-emerald-300/40 mt-1">
                Prezzo: {hovered.offer.priceType === "variabile" ? "+" : ""}
                {NUMBER_4DP.format(hovered.offer.price)}{" "}
                {hovered.offer.commodity === "electricity" ? "€/kWh" : "€/Smc"}
                {hovered.offer.pcvEurAnno > 0 && (
                  <>
                    {" "}
                    · PCV: {EUR_INT_HEADER.format(hovered.offer.pcvEurAnno)}{" "}
                    €/anno
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <style
        // eslint-disable-next-line react/no-unknown-property
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes tilefall {
              from { opacity: 0; transform: translateY(-60px) scale(0.6); }
              60%  { opacity: 1; transform: translateY(4px) scale(1.02); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes tilepulse {
              0%, 100% { transform: scale(1); box-shadow: 0 0 6px var(--glow); }
              50% { transform: scale(2.2); box-shadow: 0 0 24px var(--glow), 0 0 40px var(--glow); z-index: 5; }
            }
            .tile-fall {
              opacity: 0;
              animation: tilefall 0.6s cubic-bezier(0.3, 0.6, 0.3, 1) forwards;
            }
            .tile-pulse {
              animation: tilepulse 1.2s ease-in-out infinite !important;
              z-index: 5;
              opacity: 1 !important;
            }
            .tile-dim {
              opacity: 0.18 !important;
              transition: opacity 0.3s;
              animation: none !important;
            }
            .tile-fall:hover:not(.tile-pulse) {
              animation: none;
              opacity: 1;
              transform: scale(2.5);
              z-index: 20;
            }
            @keyframes tilewinner {
              0%, 100% {
                transform: scale(1.6);
                box-shadow: 0 0 16px var(--glow), 0 0 32px rgba(20, 217, 122, 0.6);
              }
              50% {
                transform: scale(1.95);
                box-shadow: 0 0 24px var(--glow), 0 0 56px rgba(20, 217, 122, 0.95);
              }
            }
            .tile-winner {
              animation: tilewinner 1.5s ease-in-out infinite !important;
              z-index: 15 !important;
              opacity: 1 !important;
            }
          `,
        }}
      />
    </div>
  );
}
