"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
}

interface Section {
  key: string;
  title: string;
  icon: ReactNode;
  unit: string;
  isSpread: boolean;
  offers: Offer[];
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

function colorForDelta(price: number, median: number): { fill: string; glow: string } {
  if (median <= 0) return { fill: "#facc15", glow: "rgba(250,204,21,0.4)" };
  const delta = (price - median) / median;
  if (delta < -0.3) return { fill: "#14d97a", glow: "rgba(20, 217, 122, 0.8)" };
  if (delta < -0.1) return { fill: "#10b981", glow: "rgba(16, 185, 129, 0.5)" };
  if (delta < 0.1) return { fill: "#facc15", glow: "rgba(250, 204, 21, 0.5)" };
  if (delta < 0.3) return { fill: "#fb923c", glow: "rgba(251, 146, 60, 0.6)" };
  return { fill: "#f43f5e", glow: "rgba(244, 63, 94, 0.8)" };
}

function groupOffers(offers: Offer[]): Section[] {
  const groups = new Map<string, Offer[]>();
  for (const o of offers) {
    const key = `${o.commodity}_${o.priceType}`;
    const arr = groups.get(key) ?? [];
    arr.push(o);
    groups.set(key, arr);
  }
  const meta: Section[] = [
    {
      key: "electricity_fisso",
      title: "LUCE FISSA",
      icon: LUCE_ICON,
      unit: "€/kWh",
      isSpread: false,
      offers: groups.get("electricity_fisso") ?? [],
    },
    {
      key: "electricity_variabile",
      title: "LUCE VARIABILE (spread)",
      icon: LUCE_ICON,
      unit: "€/kWh",
      isSpread: true,
      offers: groups.get("electricity_variabile") ?? [],
    },
    {
      key: "gas_fisso",
      title: "GAS FISSA",
      icon: GAS_ICON,
      unit: "€/Smc",
      isSpread: false,
      offers: groups.get("gas_fisso") ?? [],
    },
    {
      key: "gas_variabile",
      title: "GAS VARIABILE (spread)",
      icon: GAS_ICON,
      unit: "€/Smc",
      isSpread: true,
      offers: groups.get("gas_variabile") ?? [],
    },
  ];
  for (const sec of meta) {
    sec.offers.sort((a, b) => a.price - b.price);
  }
  return meta;
}

export function MarketMap({
  offers,
  asOf,
}: {
  offers: Offer[];
  asOf: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<{ offer: Offer; section: Section } | null>(null);
  const [search, setSearch] = useState("");
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

  const sections = useMemo(() => groupOffers(offers), [offers]);

  const distinctVendors = useMemo(() => {
    const set = new Set<string>();
    for (const o of offers) set.add(o.vendor);
    return Array.from(set).sort();
  }, [offers]);

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
            Dati in arrivo: la prima rilevazione ARERA arriverà al prossimo ETL.
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
                <span>PLACET DOMESTICO</span>
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
            </div>

            <div className="w-full sm:w-80 space-y-2">
              <div>
                <label className="block text-xs font-mono text-emerald-300/60 mb-1 uppercase tracking-wider">
                  Cerca fornitore
                </label>
                <input
                  list="vendors-list"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Es. ENEL, EDISON, A2A…"
                  aria-label="Cerca fornitore"
                  className="w-full bg-black/80 border border-emerald-400/40 rounded px-3 py-2 text-emerald-200 placeholder:text-emerald-300/30 font-mono text-sm focus:outline-none focus:border-emerald-400 focus:shadow-[0_0_12px_rgba(20,217,122,0.5)] transition-shadow"
                />
                <datalist id="vendors-list">
                  {distinctVendors.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
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
          </div>
        </header>

        <div className="space-y-10">
          {sections.map((section) => {
            if (section.offers.length === 0) return null;
            const best = section.offers[0];
            const worst = section.offers[section.offers.length - 1];
            const medianValue =
              section.offers[Math.floor(section.offers.length / 2)].price;
            return (
              <section key={section.key}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-emerald-400/15 pb-2">
                  <h2 className="flex items-center gap-2 text-lg sm:text-xl font-mono font-bold text-emerald-300 tracking-wider">
                    {section.icon}
                    {section.title}
                  </h2>
                  <span className="font-mono text-xs sm:text-sm text-emerald-300/60 tabular-nums">
                    {section.offers.length} OFFERTE · MED{" "}
                    {section.isSpread ? "+" : ""}
                    {NUMBER_4DP.format(medianValue)} {section.unit} · BEST{" "}
                    {section.isSpread ? "+" : ""}
                    {NUMBER_4DP.format(best.price)} · WORST{" "}
                    {section.isSpread ? "+" : ""}
                    {NUMBER_4DP.format(worst.price)}
                  </span>
                </div>

                <div
                  className="grid gap-[3px]"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(22px, 1fr))",
                  }}
                >
                  {section.offers.map((o) => {
                    const { fill, glow } = colorForDelta(o.price, o.median);
                    const idx = globalIndex++;
                    const isMatch = matchesSearch(o.vendor);
                    const isDimmed = searchActive && !isMatch;
                    const cls = [
                      "aspect-square rounded-[3px] cursor-pointer relative tile-fall focus:outline-none focus:ring-2 focus:ring-emerald-400",
                      isMatch ? "tile-pulse" : "",
                      isDimmed ? "tile-dim" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <button
                        key={o.codice}
                        type="button"
                        className={cls}
                        style={{
                          background: fill,
                          boxShadow: `0 0 6px ${glow}`,
                          animationDelay: `${idx * 3}ms`,
                          ["--glow" as string]: glow,
                        }}
                        onMouseEnter={() => setHovered({ offer: o, section })}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered({ offer: o, section })}
                        onBlur={() => setHovered(null)}
                        aria-label={`${o.vendor} ${NUMBER_4DP.format(o.price)} ${section.unit}`}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-12 text-center text-emerald-300/40 font-mono text-xs space-y-1">
          <p>
            ENERGY INDEX · MARKET MAP · DATI ARERA PORTALE OFFERTE PLACET · ULTIMA
            RILEVAZIONE {asOf ?? "—"}
          </p>
          <p>
            <a href="/it/mercato-libero" className="hover:text-emerald-400">
              ← Torna all&apos;osservatorio
            </a>
          </p>
        </footer>
      </div>

      {hovered && (
        <div
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/95 border-2 border-emerald-400/60 text-emerald-300 font-mono px-6 py-3 rounded-lg backdrop-blur-md z-30 shadow-[0_0_30px_rgba(20,217,122,0.4)] pointer-events-none min-w-[280px] max-w-[90vw]"
        >
          <div className="text-base sm:text-lg font-bold text-emerald-400 tracking-wider">
            {hovered.offer.vendor}
          </div>
          <div className="text-xs text-emerald-300/60 mb-2">
            {hovered.offer.codice} · {hovered.section.title}
          </div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">
            {hovered.section.isSpread ? "+" : ""}
            {NUMBER_4DP.format(hovered.offer.price)}{" "}
            <span className="text-sm font-normal text-emerald-300/70">
              {hovered.section.unit}
            </span>
          </div>
          {hovered.offer.median > 0 && (
            <div className="text-xs text-emerald-300/70 tabular-nums mt-1">
              Δ vs mediana{" "}
              {hovered.section.isSpread ? "+" : ""}
              {NUMBER_4DP.format(hovered.offer.median)}:{" "}
              <span
                style={{
                  color:
                    hovered.offer.price < hovered.offer.median
                      ? "#14d97a"
                      : hovered.offer.price > hovered.offer.median * 1.1
                        ? "#f43f5e"
                        : "#facc15",
                }}
              >
                {(((hovered.offer.price - hovered.offer.median) /
                  hovered.offer.median) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          )}
        </div>
      )}

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
          `,
        }}
      />
    </div>
  );
}
