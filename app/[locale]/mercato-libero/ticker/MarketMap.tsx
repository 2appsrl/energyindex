"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  unit: string;
  isSpread: boolean;
  offers: Offer[];
}

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
      title: "⚡ LUCE FISSA",
      unit: "€/kWh",
      isSpread: false,
      offers: groups.get("electricity_fisso") ?? [],
    },
    {
      key: "electricity_variabile",
      title: "⚡ LUCE VARIABILE (spread)",
      unit: "€/kWh",
      isSpread: true,
      offers: groups.get("electricity_variabile") ?? [],
    },
    {
      key: "gas_fisso",
      title: "🔥 GAS FISSA",
      unit: "€/Smc",
      isSpread: false,
      offers: groups.get("gas_fisso") ?? [],
    },
    {
      key: "gas_variabile",
      title: "🔥 GAS VARIABILE (spread)",
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

            <div className="w-full sm:w-80">
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
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3 border-b border-emerald-400/15 pb-2">
                  <h2 className="text-lg sm:text-xl font-mono font-bold text-emerald-300 tracking-wider">
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
