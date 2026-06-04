"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Flame, Zap } from "lucide-react";

export interface CteOffer {
  codice: string;
  vendor: string;
  commodity: "electricity" | "gas";
  priceType: "fisso" | "variabile";
  price: number;
  pcvEurAnno: number;
  creatorRole?: "superadmin" | "admin" | "agency" | null;
  source?: string | null;
}

// Formattazione: stessa convenzione della Market Map
const NUM = new Intl.NumberFormat("it-IT");
const NUM_4DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const EUR_INT = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Stesso calcolo bolletta annua usato in Market Map / Simulator: PCV +
 * price × volume, con proxy spot PUN/PSV aggiunto agli spread delle
 * variabili (altrimenti spread 0,02 €/kWh batterebbe un fisso 0,20).
 */
function annualCommodityCost(o: CteOffer, volume: number): number {
  const SPOT_LUCE = 0.10;
  const SPOT_GAS = 0.35;
  let unitPrice = o.price;
  if (o.priceType === "variabile") {
    unitPrice += o.commodity === "electricity" ? SPOT_LUCE : SPOT_GAS;
  }
  return o.pcvEurAnno + unitPrice * volume;
}

function isCertificate(o: CteOffer): boolean {
  if (o.source !== "energiapro_commerciali") return true;
  return o.creatorRole === "superadmin";
}

interface SpinResult {
  winner: CteOffer;
  totalAnalyzed: number;
  totalEurAnno: number;
}

/**
 * Durate dello spin (ms). Le 3 reel decelerano e si fermano in
 * sequenza per il classico effetto "stop one by one" delle slot
 * machine. La reel 3 (€/anno) dura piu' a lungo per il pathos finale.
 */
const REEL_DURATIONS = [2200, 2700, 3300];
const TICK_MS = 60; // intervallo cambio simbolo durante spin

export function CteMachine({ offers }: { offers: CteOffer[] }) {
  const [commodity, setCommodity] = useState<"electricity" | "gas">(
    "electricity",
  );
  const [volume, setVolume] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);

  // Tick-display: durante lo spin, ogni reel mostra valori random
  // indipendenti per il classico look casino. Quando una reel si ferma,
  // il suo tick smette di aggiornarsi e mostra il valore vincente.
  const [reelTicks, setReelTicks] = useState<[number, number, number]>([
    0, 0, 0,
  ]);
  const [reelStopped, setReelStopped] = useState<[boolean, boolean, boolean]>([
    true, true, true,
  ]);

  // Audio handle: ambient casino + click reel-stop. Niente autoplay:
  // l'AudioContext si crea solo dopo il primo SPIN (gesto utente OK).
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientHandleRef = useRef<{ stop: () => void } | null>(null);
  const [audioOn, setAudioOn] = useState(true);

  // Pool di offerte filtrate per commodity selezionata.
  const pool = useMemo(
    () =>
      offers.filter(
        (o) => o.commodity === commodity && o.pcvEurAnno > 0,
      ),
    [offers, commodity],
  );

  const volumeUnit = commodity === "electricity" ? "kWh" : "Smc";
  const volumeMax = commodity === "electricity" ? 10000 : 3000;
  const volumeStep = commodity === "electricity" ? 100 : 50;
  const priceUnit = commodity === "electricity" ? "€/kWh" : "€/Smc";

  const canSpin = !spinning && volume > 0 && pool.length > 0;

  const playSound = useCallback(
    (type: "tick" | "stop" | "win" | "coin" | "lever") => {
      if (!audioOn || !audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const t0 = ctx.currentTime;
      if (type === "tick") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 600 + Math.random() * 400;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.04, t0 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.06);
      } else if (type === "stop") {
        // "Ka-chunk" reel-stop: triangle 180→60 Hz envelope decrescente
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(180, t0);
        osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.15);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.18, t0 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.25);
      } else if (type === "lever") {
        // Cric-crac leva: noise burst + slide down
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(900, t0);
        filter.frequency.exponentialRampToValueAtTime(200, t0 + 0.25);
        filter.Q.value = 4;
        const g = ctx.createGain();
        g.gain.value = 0.22;
        src.connect(filter).connect(g).connect(ctx.destination);
        src.start(t0);
        src.stop(t0 + 0.3);
      } else if (type === "win") {
        // Fanfara jackpot: 4 note pentatoniche Do maggiore ascendenti
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const n = ctx.createOscillator();
          const g = ctx.createGain();
          n.type = "sine";
          n.frequency.value = freq;
          const start = t0 + i * 0.12;
          g.gain.setValueAtTime(0, start);
          g.gain.linearRampToValueAtTime(0.22, start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
          n.connect(g).connect(ctx.destination);
          n.start(start);
          n.stop(start + 0.6);
        });
      } else if (type === "coin") {
        // Coin shower: 14 ding bell metallici scaglionati (frequenze
        // random alte 1.8-3.5 kHz con armonica per timbro "metallo").
        // Crea l'illusione delle monete che cadono nel pozzo metallico.
        for (let i = 0; i < 14; i++) {
          const start = t0 + i * 0.07 + Math.random() * 0.05;
          const baseFreq = 1800 + Math.random() * 1700;
          // Fondamentale
          const f = ctx.createOscillator();
          const gF = ctx.createGain();
          f.type = "triangle";
          f.frequency.value = baseFreq;
          gF.gain.setValueAtTime(0, start);
          gF.gain.linearRampToValueAtTime(0.09, start + 0.005);
          gF.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
          f.connect(gF).connect(ctx.destination);
          f.start(start);
          f.stop(start + 0.2);
          // Armonica superiore per "tintinnio" metallico
          const h = ctx.createOscillator();
          const gH = ctx.createGain();
          h.type = "sine";
          h.frequency.value = baseFreq * 2.4;
          gH.gain.setValueAtTime(0, start);
          gH.gain.linearRampToValueAtTime(0.04, start + 0.005);
          gH.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
          h.connect(gH).connect(ctx.destination);
          h.start(start);
          h.stop(start + 0.15);
        }
      }
    },
    [audioOn],
  );

  /**
   * Casino ambient: drone di fondo continuo (Do2 sawtooth attraverso
   * lowpass + LFO) + bell ding casuali ogni 5-12 sec (illusione di
   * jackpot in fondo alla sala) + chip rustle leggero. Volume basso
   * (-30 dB rispetto al main) per non coprire i tick dello spin.
   * Ritorna handle con stop() che fa fade-out 0.3 s + cleanup.
   */
  const startCasinoAmbient = useCallback(() => {
    if (!audioCtxRef.current) return null;
    const ctx = audioCtxRef.current;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2.5);

    // Drone Do2 + Sol2 (interval di quinta, "tappeto casino")
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 600;
    droneFilter.Q.value = 3;
    droneFilter.connect(master);
    const droneOscs: OscillatorNode[] = [];
    [65.41, 98.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      osc.connect(g).connect(droneFilter);
      osc.start();
      droneOscs.push(osc);
    });
    // LFO sul filtro per "respiro"
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(droneFilter.frequency);
    lfo.start();

    // Distant bell dings random ogni 5-12s — "qualcuno ha vinto in fondo alla sala"
    let bellTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleBell = () => {
      bellTimer = setTimeout(
        () => {
          if (!audioCtxRef.current) return;
          const bell = ctx.createOscillator();
          const bg = ctx.createGain();
          bell.type = "sine";
          bell.frequency.value = 1200 + Math.random() * 800;
          const bt = ctx.currentTime;
          bg.gain.setValueAtTime(0, bt);
          bg.gain.linearRampToValueAtTime(0.04, bt + 0.02);
          bg.gain.exponentialRampToValueAtTime(0.0001, bt + 1.5);
          bell.connect(bg).connect(master);
          bell.start(bt);
          bell.stop(bt + 1.6);
          scheduleBell();
        },
        5000 + Math.random() * 7000,
      );
    };
    scheduleBell();

    // Chip rustle random ogni 3-8s (noise burst lowpass, "fiches sul tappeto")
    let chipTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleChip = () => {
      chipTimer = setTimeout(
        () => {
          if (!audioCtxRef.current) return;
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) {
            d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.6;
          }
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.value = 1800;
          const g = ctx.createGain();
          g.gain.value = 0.06;
          src.connect(f).connect(g).connect(master);
          src.start();
          src.stop(ctx.currentTime + 0.2);
          scheduleChip();
        },
        3000 + Math.random() * 5000,
      );
    };
    scheduleChip();

    return {
      stop: () => {
        if (bellTimer) clearTimeout(bellTimer);
        if (chipTimer) clearTimeout(chipTimer);
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + 0.3);
        setTimeout(() => {
          try {
            for (const osc of droneOscs) osc.stop();
            lfo.stop();
          } catch {
            /* oscillators may have already stopped */
          }
        }, 400);
      },
    };
  }, []);

  // Sync ambient con audioOn: parte/stoppa quando l'utente cambia toggle.
  // L'AudioContext viene inizializzato pigro al primo SPIN; finche' non
  // esiste, l'ambient non parte (e' OK — l'utente non l'ha ancora
  // attivato con un gesto).
  useEffect(() => {
    if (audioOn && audioCtxRef.current && !ambientHandleRef.current) {
      ambientHandleRef.current = startCasinoAmbient();
    } else if (!audioOn && ambientHandleRef.current) {
      ambientHandleRef.current.stop();
      ambientHandleRef.current = null;
    }
    return () => {
      if (ambientHandleRef.current) {
        ambientHandleRef.current.stop();
        ambientHandleRef.current = null;
      }
    };
  }, [audioOn, startCasinoAmbient]);

  const handleSpin = useCallback(() => {
    if (!canSpin) return;
    // Init AudioContext al primo gesto utente (autoplay policy).
    // Subito dopo: starta l'ambient casino (drone + bells + chip rustle).
    if (audioOn && !audioCtxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new AC();
      void audioCtxRef.current.resume();
      ambientHandleRef.current = startCasinoAmbient();
    }
    // Cric-crac leva: suona PRIMA dello spin, come tirare il braccio
    playSound("lever");

    // Calcola il vero vincitore lato logica.
    let bestIdx = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pool.length; i++) {
      const c = annualCommodityCost(pool[i], volume);
      if (c < bestCost) {
        bestCost = c;
        bestIdx = i;
      }
    }
    const winner = pool[bestIdx];

    setResult(null);
    setSpinning(true);
    setReelStopped([false, false, false]);

    // Ref locale per leggere lo stato "fermo" delle reel dall'interval
    // senza dipendere da React state (che causerebbe stale closures).
    const reelStoppedRef = { current: [false, false, false] as boolean[] };

    // Tick interval: ogni reel "spinna" mostrando un indice random nel
    // pool. Si ferma dopo la sua durata, snap sul winner index.
    const tickHandle = setInterval(() => {
      setReelTicks((prev) => {
        const next: [number, number, number] = [...prev];
        for (let r = 0; r < 3; r++) {
          if (!reelStoppedRef.current[r]) {
            next[r] = Math.floor(Math.random() * pool.length);
          }
        }
        return next;
      });
      // Tick sound leggero — frequenza random per "varieta' acustica"
      if (Math.random() < 0.3) playSound("tick");
    }, TICK_MS);

    REEL_DURATIONS.forEach((dur, idx) => {
      setTimeout(() => {
        reelStoppedRef.current[idx] = true;
        setReelStopped((prev) => {
          const next: [boolean, boolean, boolean] = [...prev];
          next[idx] = true;
          return next;
        });
        // Snap al winner per quella reel
        setReelTicks((prev) => {
          const next: [number, number, number] = [...prev];
          next[idx] = bestIdx;
          return next;
        });
        playSound("stop");
      }, dur);
    });

    // Spin completo: fanfara jackpot + cascata monete
    setTimeout(() => {
      clearInterval(tickHandle);
      setSpinning(false);
      setResult({
        winner,
        totalAnalyzed: pool.length,
        totalEurAnno: bestCost,
      });
      playSound("win");
      // Cascata di monete dopo la fanfara, sovrapposta per "shower" effect
      setTimeout(() => playSound("coin"), 350);
    }, REEL_DURATIONS[2] + 50);
  }, [canSpin, pool, volume, audioOn, playSound, startCasinoAmbient]);

  // Reset risultato quando cambia commodity o volume
  useEffect(() => {
    setResult(null);
  }, [commodity, volume]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-[#1a0508] via-[#2a0a0e] to-[#1a0508] text-white font-mono">
      <CasinoBackground />

      <FloatingSuits />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        {/* HEADER: marquee 777 + neon CTE MACHINE + carte */}
        <header className="text-center mb-10 sm:mb-14 relative">
          <MarqueeMarquee />
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-amber-200/70 mb-2">
            ♠ Energy Index Presents ♣
          </div>
          <h1
            className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight neon-title leading-none"
            aria-label="CTE Machine"
          >
            <span className="text-rose-400">CTE</span>{" "}
            <span className="text-amber-300">MACHINE</span>
          </h1>
          <p className="mt-3 text-amber-100/70 text-xs sm:text-sm tracking-widest uppercase">
            🎰 La slot machine delle offerte luce e gas 🎰
          </p>
          <p className="mt-2 text-rose-300/70 text-[10px] tracking-[0.3em] uppercase italic">
            ♦ Place your bet · Let Lady Luck pick your bill ♥
          </p>
        </header>

        {/* CONTROL PANEL */}
        <section className="bg-black/40 backdrop-blur-sm border-2 border-amber-500/30 rounded-2xl p-5 sm:p-7 shadow-[0_0_40px_rgba(245,158,11,0.15)] mb-8">
          <div className="text-center text-[10px] uppercase tracking-[0.3em] text-rose-300/70 mb-4">
            ♠♥♦♣ Place Your Bet ♣♦♥♠
          </div>
          {/* Commodity toggle */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <CommodityButton
              active={commodity === "electricity"}
              onClick={() => setCommodity("electricity")}
              icon={<Zap className="h-5 w-5" strokeWidth={2.5} />}
              label="LUCE"
              accent="emerald"
            />
            <CommodityButton
              active={commodity === "gas"}
              onClick={() => setCommodity("gas")}
              icon={<Flame className="h-5 w-5" strokeWidth={2.5} />}
              label="GAS"
              accent="amber"
            />
          </div>

          {/* Slider consumo */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="cte-volume"
                className="text-xs font-mono uppercase tracking-widest text-amber-200/70"
              >
                Il tuo consumo annuo
              </label>
              <span className="text-sm font-bold bg-amber-300 text-black px-2.5 py-0.5 rounded tabular-nums">
                {NUM.format(volume)} {volumeUnit}
              </span>
            </div>
            <input
              id="cte-volume"
              type="range"
              min={0}
              max={volumeMax}
              step={volumeStep}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              disabled={spinning}
              className="w-full accent-amber-400 cursor-pointer disabled:opacity-50"
              aria-label={`Consumo annuo in ${volumeUnit}`}
            />
            <div className="flex justify-between text-[10px] text-amber-200/40 tabular-nums">
              <span>0</span>
              <span>~{NUM.format(Math.round(volume / 12))} {volumeUnit}/mese</span>
              <span>{NUM.format(volumeMax)}</span>
            </div>
          </div>

          {/* Audio toggle inline (piccolo, top right) */}
          <div className="flex items-center justify-end mt-3">
            <button
              type="button"
              onClick={() => setAudioOn((v) => !v)}
              className="text-[10px] uppercase tracking-widest text-amber-200/60 hover:text-amber-200 inline-flex items-center gap-1.5"
              aria-pressed={audioOn}
            >
              <span
                className={
                  audioOn
                    ? "inline-block w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"
                    : "inline-block w-1.5 h-1.5 rounded-full border border-amber-300/40"
                }
                aria-hidden
              />
              {audioOn ? "Suoni casino ON" : "Suoni casino OFF"}
            </button>
          </div>
        </section>

        {/* SLOT MACHINE */}
        <section className="bg-gradient-to-b from-[#3a0e15] to-[#1a0508] border-4 border-amber-400/60 rounded-3xl p-5 sm:p-8 shadow-[0_0_60px_rgba(245,158,11,0.3),inset_0_0_30px_rgba(0,0,0,0.6)] mb-8 relative">
          {/* Luci decorative angoli */}
          <CornerLights />

          {/* Banner classico slot symbols */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 text-xl sm:text-2xl mb-3 text-amber-300/80 select-none">
            <span aria-hidden className="symbol-blink" style={{ animationDelay: "0s" }}>🍒</span>
            <span aria-hidden className="symbol-blink" style={{ animationDelay: "0.2s" }}>🍋</span>
            <span aria-hidden className="symbol-blink" style={{ animationDelay: "0.4s" }}>🔔</span>
            <span aria-hidden className="text-amber-200 font-black tracking-tighter neon-777">7 7 7</span>
            <span aria-hidden className="symbol-blink" style={{ animationDelay: "0.6s" }}>💎</span>
            <span aria-hidden className="symbol-blink" style={{ animationDelay: "0.8s" }}>🎲</span>
            <span aria-hidden className="symbol-blink" style={{ animationDelay: "1.0s" }}>💰</span>
          </div>

          {/* Pull lever decorativo a destra */}
          <PullLever spinning={spinning} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <SlotReel
              label="BRAND"
              value={
                pool.length > 0
                  ? pool[reelTicks[0] % pool.length]?.vendor ?? "—"
                  : "—"
              }
              stopped={reelStopped[0]}
              spinning={spinning}
            />
            <SlotReel
              label="CODICE"
              value={
                pool.length > 0
                  ? truncateCode(pool[reelTicks[1] % pool.length]?.codice ?? "—")
                  : "—"
              }
              stopped={reelStopped[1]}
              spinning={spinning}
            />
            <SlotReel
              label="BOLLETTA/ANNO"
              value={
                pool.length > 0
                  ? EUR_INT.format(
                      annualCommodityCost(
                        pool[reelTicks[2] % pool.length],
                        volume,
                      ),
                    )
                  : "—"
              }
              stopped={reelStopped[2]}
              spinning={spinning}
            />
          </div>

          {/* SPIN BUTTON */}
          <div className="mt-7 flex flex-col items-center">
            <div className="text-[10px] uppercase tracking-[0.4em] text-amber-200/40 mb-2">
              🎲 Roll The Dice On Your Bill 🎲
            </div>
            <button
              type="button"
              onClick={handleSpin}
              disabled={!canSpin}
              className="spin-button group relative overflow-hidden"
              aria-label="Spin that wheel"
            >
              <span className="spin-button-inner">
                {spinning
                  ? "🎰 SPINNING… 🎰"
                  : volume === 0
                    ? "Inserisci il tuo consumo"
                    : pool.length === 0
                      ? "Nessuna offerta disponibile"
                      : "🎰 SPIN THAT WHEEL 🎰"}
              </span>
            </button>
            <div className="text-[9px] uppercase tracking-[0.4em] text-rose-300/40 mt-2">
              {spinning ? "✦ Lady Luck is dancing ✦" : "✦ All in or fold? ✦"}
            </div>
          </div>

          {!spinning && pool.length > 0 && volume > 0 && !result && (
            <p className="text-center mt-4 text-amber-200/60 text-xs italic">
              La ruota analizzerà {pool.length} offerte{" "}
              {commodity === "electricity" ? "luce" : "gas"} per trovare quella
              più conveniente per il tuo consumo.
              <br />
              <span className="text-rose-300/60 text-[10px] uppercase tracking-widest not-italic">
                Odds: 1 vincente · {pool.length - 1} perdenti
              </span>
            </p>
          )}
        </section>

        {/* RESULT */}
        {result && !spinning && (
          <ResultPanel
            result={result}
            commodity={commodity}
            volume={volume}
            volumeUnit={volumeUnit}
            priceUnit={priceUnit}
          />
        )}

        <footer className="mt-12 text-center text-amber-200/40 text-[10px] uppercase tracking-widest space-y-1.5">
          <p className="text-rose-300/40 italic tracking-[0.3em]">
            ♠♥♦♣ The house always wins · unless you spin smart ♣♦♥♠
          </p>
          <p>
            Energy Index · CTE Machine · Dati Market Map (PLACET ARERA +
            Mercato Libero)
          </p>
          <p className="mt-2">
            <Link
              href="/it/mercato-libero/ticker"
              className="hover:text-amber-200 underline"
            >
              ← Cash out · Esplora tutte le offerte in Market Map
            </Link>
          </p>
          <p className="text-amber-200/30 text-[9px] mt-3 not-italic">
            Disclaimer: questo non e&apos; gioco d&apos;azzardo. E&apos; un
            tool di scelta dell&apos;offerta energetica con grafica casino.
            Nessuna scommessa, nessuna perdita — solo la migliore offerta sul
            mercato.
          </p>
        </footer>
      </div>

      <style
        // eslint-disable-next-line react/no-unknown-property
        dangerouslySetInnerHTML={{
          __html: `
            .neon-title {
              text-shadow:
                0 0 10px rgba(252, 165, 165, 0.8),
                0 0 22px rgba(252, 165, 165, 0.5),
                0 0 40px rgba(252, 211, 77, 0.6);
              animation: neonflicker 4s infinite;
            }
            @keyframes neonflicker {
              0%, 100% { opacity: 1; }
              92%, 94% { opacity: 0.92; }
              93% { opacity: 0.7; }
            }
            .spin-button {
              position: relative;
              padding: 1.25rem 3rem;
              font-size: 1.25rem;
              font-weight: 900;
              letter-spacing: 0.15em;
              color: #1a0508;
              background: linear-gradient(180deg, #fde047 0%, #f59e0b 50%, #b45309 100%);
              border-radius: 9999px;
              border: 3px solid #fef3c7;
              box-shadow:
                0 0 0 4px #1a0508,
                0 0 30px rgba(252, 211, 77, 0.7),
                0 8px 20px rgba(0,0,0,0.5),
                inset 0 2px 4px rgba(255,255,255,0.6),
                inset 0 -2px 4px rgba(0,0,0,0.3);
              transition: transform 0.1s, box-shadow 0.2s;
              cursor: pointer;
              font-family: inherit;
              text-transform: uppercase;
            }
            .spin-button:hover:not(:disabled) {
              transform: translateY(-2px) scale(1.03);
              box-shadow:
                0 0 0 4px #1a0508,
                0 0 50px rgba(252, 211, 77, 1),
                0 12px 28px rgba(0,0,0,0.6),
                inset 0 2px 4px rgba(255,255,255,0.6),
                inset 0 -2px 4px rgba(0,0,0,0.3);
            }
            .spin-button:active:not(:disabled) {
              transform: translateY(1px) scale(0.98);
            }
            .spin-button:disabled {
              opacity: 0.4;
              cursor: not-allowed;
              filter: grayscale(0.5);
            }
            .spin-button-inner {
              position: relative;
              display: inline-block;
              text-shadow: 0 1px 0 rgba(255,255,255,0.4);
            }

            @keyframes reelblur {
              0%, 100% { filter: blur(2px); transform: translateY(0); }
              50% { filter: blur(3px); transform: translateY(-2px); }
            }
            .reel-spinning .reel-value {
              animation: reelblur 0.1s linear infinite;
            }
            .reel-stop-glow {
              animation: reelstopglow 0.6s ease-out;
            }
            @keyframes reelstopglow {
              0% { box-shadow: 0 0 80px rgba(252, 211, 77, 1), inset 0 0 30px rgba(252, 211, 77, 0.8); }
              100% { box-shadow: 0 0 20px rgba(252, 211, 77, 0.4), inset 0 0 10px rgba(0, 0, 0, 0.6); }
            }

            @keyframes resultreveal {
              from { opacity: 0; transform: translateY(20px) scale(0.95); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .result-panel {
              animation: resultreveal 0.6s cubic-bezier(0.2, 0.7, 0.3, 1.2);
            }
            @keyframes coinrain {
              0% { transform: translateY(-100vh) rotate(0deg); opacity: 0; }
              10% { opacity: 1; }
              100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
            }

            @keyframes cornerblink {
              0%, 100% { opacity: 1; box-shadow: 0 0 8px currentColor, 0 0 16px currentColor; }
              50% { opacity: 0.3; box-shadow: 0 0 4px currentColor; }
            }
            .corner-light {
              animation: cornerblink 0.8s ease-in-out infinite;
            }
            @keyframes reelscan {
              from { transform: translateY(-100px); }
              to { transform: translateY(100px); }
            }
            @keyframes marqueeblink {
              0%, 100% { opacity: 1; text-shadow: 0 0 8px currentColor, 0 0 18px currentColor; }
              50% { opacity: 0.55; text-shadow: 0 0 4px currentColor; }
            }
            .marquee-blink {
              animation: marqueeblink 0.9s ease-in-out infinite;
            }
            @keyframes symbolblink {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(0.9); }
            }
            .symbol-blink {
              animation: symbolblink 1.4s ease-in-out infinite;
            }
            @keyframes neon777 {
              0%, 100% {
                text-shadow:
                  0 0 8px rgba(252, 211, 77, 1),
                  0 0 16px rgba(252, 211, 77, 0.8),
                  0 0 32px rgba(248, 113, 113, 0.6);
              }
              50% {
                text-shadow:
                  0 0 4px rgba(252, 211, 77, 0.6),
                  0 0 8px rgba(252, 211, 77, 0.4);
              }
            }
            .neon-777 {
              animation: neon777 0.7s ease-in-out infinite;
              font-size: 1.2em;
            }
            @keyframes floatingsuit {
              0%, 100% { transform: translateY(0) rotate(-3deg); }
              50% { transform: translateY(-14px) rotate(3deg); }
            }
            .floating-suit {
              animation: floatingsuit 6s ease-in-out infinite;
            }
            @keyframes leverpull {
              0% { transform: rotate(0deg); }
              35% { transform: rotate(45deg); }
              70% { transform: rotate(40deg); }
              100% { transform: rotate(0deg); }
            }
            .lever-pull {
              animation: leverpull 0.8s cubic-bezier(0.5, 0.1, 0.3, 1);
            }
            @keyframes jackpotbounce {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.06); }
            }
            .jackpot-bounce {
              animation: jackpotbounce 1.1s ease-in-out infinite;
              text-shadow:
                0 0 12px rgba(252, 211, 77, 0.9),
                0 0 28px rgba(252, 211, 77, 0.6),
                0 0 50px rgba(248, 113, 113, 0.5);
            }
          `,
        }}
      />
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function CommodityButton({
  active,
  onClick,
  icon,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accent: "emerald" | "amber";
}) {
  const baseColors =
    accent === "emerald"
      ? {
          activeBg: "bg-emerald-400",
          activeText: "text-black",
          inactiveText: "text-emerald-300/60",
          border: "border-emerald-400/40",
          glow: "shadow-[0_0_20px_rgba(20,217,122,0.5)]",
        }
      : {
          activeBg: "bg-amber-300",
          activeText: "text-black",
          inactiveText: "text-amber-200/60",
          border: "border-amber-400/40",
          glow: "shadow-[0_0_20px_rgba(245,158,11,0.5)]",
        };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold tracking-widest text-sm sm:text-base transition-all ${
        active
          ? `${baseColors.activeBg} ${baseColors.activeText} ${baseColors.glow} border-transparent`
          : `bg-black/40 ${baseColors.inactiveText} ${baseColors.border} hover:bg-black/60`
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SlotReel({
  label,
  value,
  stopped,
  spinning,
}: {
  label: string;
  value: string;
  stopped: boolean;
  spinning: boolean;
}) {
  const justStopped = stopped && spinning;
  return (
    <div className="flex flex-col items-center">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-amber-200/50 mb-1.5">
        {label}
      </div>
      <div
        className={`
          relative w-full h-24 sm:h-28
          bg-gradient-to-b from-black via-[#0a0204] to-black
          rounded-xl border-2 border-amber-400/40
          flex items-center justify-center
          overflow-hidden
          ${justStopped ? "reel-stop-glow" : ""}
          ${spinning && !stopped ? "reel-spinning" : ""}
        `}
        style={{
          boxShadow: stopped
            ? "0 0 20px rgba(252, 211, 77, 0.5), inset 0 0 14px rgba(0,0,0,0.7)"
            : "inset 0 0 14px rgba(0,0,0,0.7)",
        }}
      >
        {/* Scanline luminoso che attraversa il reel durante spin */}
        {spinning && !stopped && (
          <div
            className="absolute inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-60 pointer-events-none"
            style={{
              animation: "reelscan 0.5s linear infinite",
              top: "50%",
            }}
          />
        )}
        <div
          className={`reel-value px-2 font-bold tabular-nums text-center truncate w-full ${
            stopped ? "text-amber-200" : "text-amber-100/70"
          } text-base sm:text-lg`}
          style={{
            textShadow: stopped
              ? "0 0 8px rgba(252, 211, 77, 0.8)"
              : "0 0 4px rgba(252, 211, 77, 0.4)",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function CornerLights() {
  // 4 angoli con luci lampeggianti tipo "marquee" cabaret.
  return (
    <>
      {(
        [
          ["top-2 left-2", "text-rose-400"],
          ["top-2 right-2", "text-amber-300"],
          ["bottom-2 left-2", "text-amber-300"],
          ["bottom-2 right-2", "text-rose-400"],
        ] as const
      ).map(([pos, color], i) => (
        <span
          key={i}
          className={`absolute ${pos} ${color} corner-light pointer-events-none`}
          style={{ animationDelay: `${i * 0.2}s` }}
          aria-hidden
        >
          <span className="inline-block w-2 h-2 rounded-full bg-current" />
        </span>
      ))}
    </>
  );
}

function ResultPanel({
  result,
  commodity,
  volume,
  volumeUnit,
  priceUnit,
}: {
  result: SpinResult;
  commodity: "electricity" | "gas";
  volume: number;
  volumeUnit: string;
  priceUnit: string;
}) {
  const o = result.winner;
  const isCert = isCertificate(o);
  return (
    <section
      aria-live="polite"
      className="result-panel bg-gradient-to-br from-amber-900/30 via-black/60 to-rose-900/20 border-4 border-amber-400 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(252,211,77,0.5)] relative overflow-hidden"
    >
      <CornerLights />

      <div className="text-center mb-5 relative">
        <div className="text-amber-200/40 text-[10px] uppercase tracking-[0.5em] mb-1">
          ✦ ✦ ✦ BIG WIN ✦ ✦ ✦
        </div>
        <div className="text-amber-300 text-3xl sm:text-5xl mb-1 tracking-widest jackpot-bounce font-black">
          🏆 J A C K P O T 🏆
        </div>
        <div className="text-rose-300/80 text-xs sm:text-sm uppercase tracking-[0.3em] mt-2">
          ♠ House odds beaten ♥ The chip is yours ♦
        </div>
        <div className="text-amber-100/60 text-[10px] uppercase tracking-[0.4em] mt-2">
          Migliore offerta {commodity === "electricity" ? "luce" : "gas"} per{" "}
          {NUM.format(volume)} {volumeUnit}/anno
        </div>
      </div>

      <div className="bg-black/50 backdrop-blur-sm border-2 border-amber-400/60 rounded-2xl p-5 sm:p-6 space-y-4">
        {/* Brand */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-3xl sm:text-5xl font-black text-amber-200 tracking-tight">
            {o.vendor}
          </h2>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
              isCert
                ? "bg-emerald-400/20 text-emerald-300 border border-emerald-300/50"
                : "bg-amber-400/20 text-amber-300 border border-amber-300/50"
            }`}
          >
            <span aria-hidden>{isCert ? "✓" : "⚠"}</span>{" "}
            {isCert ? "Certificate" : "Non certificate"}
          </span>
        </div>

        {/* Offer code */}
        <div className="text-xs text-amber-200/60 tracking-widest break-all">
          OFFERTA · <span className="text-amber-100">{o.codice}</span>
        </div>

        {/* Condizioni */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-amber-400/20">
          <Condition
            label="Tipo"
            value={o.priceType === "fisso" ? "Prezzo fisso" : "Spread variabile"}
          />
          <Condition
            label={o.priceType === "variabile" ? "Spread" : "Prezzo materia"}
            value={`${o.priceType === "variabile" ? "+" : ""}${NUM_4DP.format(o.price)} ${priceUnit}`}
          />
          <Condition
            label="PCV (€/anno)"
            value={EUR_INT.format(o.pcvEurAnno)}
          />
        </div>

        {/* Bolletta stimata */}
        <div className="pt-4 border-t border-amber-400/20">
          <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/60 mb-1">
            Bolletta annua stimata su {NUM.format(volume)} {volumeUnit}
          </div>
          <div className="text-4xl sm:text-6xl font-black text-amber-200 tabular-nums tracking-tight">
            {EUR_INT.format(result.totalEurAnno)}
            <span className="text-base font-normal text-amber-200/60 ml-2">
              /anno
            </span>
          </div>
          <div className="text-xs text-amber-200/40 italic mt-1.5">
            Solo materia + commercializzazione (PCV). Esclude accise, IVA, oneri
            di sistema, distribuzione.
          </div>
        </div>
      </div>

      {/* Stat */}
      <div className="mt-5 text-center">
        <p className="text-amber-200/80 text-sm sm:text-base">
          🎰 Selezionata tra{" "}
          <span className="text-amber-300 font-bold text-2xl">
            {result.totalAnalyzed}
          </span>{" "}
          offerte {commodity === "electricity" ? "luce" : "gas"} analizzate 🎰
        </p>
        <p className="text-rose-300/60 text-[10px] uppercase tracking-[0.3em] mt-1.5 italic">
          Win probability: 1 / {result.totalAnalyzed}{" "}
          (= {(100 / result.totalAnalyzed).toFixed(2)}%)
        </p>
        <p className="text-amber-200/50 text-[10px] uppercase tracking-widest mt-1">
          ♠ PLACET ARERA + Mercato Libero ♣ Solo offerte con PCV {">"} 0 ♦
        </p>
      </div>
    </section>
  );
}

function Condition({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/40 rounded-lg p-3 border border-amber-400/15">
      <div className="text-[9px] uppercase tracking-widest text-amber-200/50 mb-0.5">
        {label}
      </div>
      <div className="text-sm sm:text-base font-bold text-amber-100 tabular-nums">
        {value}
      </div>
    </div>
  );
}

/**
 * Sfondo procedurale: gradient radiale dark + pattern "felt cloth"
 * casino + qualche stella/glitter scintillante. Niente immagini esterne.
 */
function CasinoBackground() {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(252, 165, 165, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(252, 211, 77, 0.12) 0%, transparent 40%)",
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 8px)",
        }}
      />
    </>
  );
}

function truncateCode(code: string): string {
  if (code.length <= 14) return code;
  return code.slice(0, 6) + "…" + code.slice(-6);
}

/**
 * Banner "777 / WIN BIG / 777" stile marquee Vegas: 3 elementi neon
 * lampeggianti in alto al header.
 */
function MarqueeMarquee() {
  return (
    <div
      aria-hidden
      className="flex justify-center items-center gap-3 sm:gap-5 text-amber-300 text-base sm:text-xl mb-4 font-black tracking-widest"
    >
      <span className="marquee-blink" style={{ animationDelay: "0s" }}>
        ✦ 777 ✦
      </span>
      <span className="marquee-blink text-rose-400" style={{ animationDelay: "0.3s" }}>
        WIN BIG
      </span>
      <span className="marquee-blink" style={{ animationDelay: "0.6s" }}>
        ✦ 777 ✦
      </span>
    </div>
  );
}

/**
 * Carte da gioco fluttuanti a sfondo (♠ ♥ ♦ ♣). 8 simboli in posizioni
 * random fisse, animazione lieve flotter su/giu' (CSS infinite).
 */
function FloatingSuits() {
  const suits = [
    { sym: "♠", pos: "top-[8%] left-[5%]", delay: "0s", color: "text-amber-200/15" },
    { sym: "♥", pos: "top-[15%] right-[8%]", delay: "1.2s", color: "text-rose-400/15" },
    { sym: "♦", pos: "top-[40%] left-[3%]", delay: "0.6s", color: "text-rose-400/15" },
    { sym: "♣", pos: "top-[55%] right-[5%]", delay: "1.8s", color: "text-amber-200/15" },
    { sym: "♠", pos: "bottom-[20%] left-[12%]", delay: "2.4s", color: "text-amber-200/12" },
    { sym: "♥", pos: "bottom-[10%] right-[15%]", delay: "0.8s", color: "text-rose-400/15" },
    { sym: "♦", pos: "top-[70%] right-[3%]", delay: "1.5s", color: "text-rose-400/12" },
    { sym: "♣", pos: "bottom-[30%] left-[7%]", delay: "2.1s", color: "text-amber-200/15" },
  ];
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
      {suits.map((s, i) => (
        <span
          key={i}
          className={`absolute ${s.pos} ${s.color} text-6xl sm:text-8xl select-none floating-suit`}
          style={{ animationDelay: s.delay }}
        >
          {s.sym}
        </span>
      ))}
    </div>
  );
}

/**
 * Leva slot machine decorativa attaccata al frame. Quando spinning,
 * la barra ruota di 35° (animazione one-shot pull-down).
 */
function PullLever({ spinning }: { spinning: boolean }) {
  return (
    <div
      aria-hidden
      className="hidden lg:block absolute right-[-50px] top-1/2 -translate-y-1/2 pointer-events-none"
    >
      {/* Knob */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-300 via-rose-500 to-rose-800 border-2 border-amber-300 shadow-[0_0_15px_rgba(244,63,94,0.6),inset_0_2px_3px_rgba(255,255,255,0.4)]" />
      {/* Bar */}
      <div
        className={`absolute top-3 left-3 w-2 h-24 bg-gradient-to-b from-amber-200 to-amber-600 rounded-full origin-top border border-amber-700/60 shadow-md ${
          spinning ? "lever-pull" : ""
        }`}
      />
    </div>
  );
}
