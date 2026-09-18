import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { theme, FONT } from "./theme";
import { KeynoteTitle } from "./scenes/KeynoteTitle";
import { BigNumber } from "./scenes/BigNumber";
import { CardsGrid } from "./scenes/CardsGrid";
import { LineChartScene } from "./scenes/LineChartScene";
import { ClaimsList } from "./scenes/ClaimsList";
import { CtaEnd } from "./scenes/CtaEnd";
import { HAS_MUSIC, MUSIC_VOLUME } from "./music";

/**
 * EIDX Pro — 60s B2B promo (traders, brokers, energy managers).
 *  0-180   (0-6s)   Hook       "Il mercato energy si muove ogni secondo."
 *  180-390 (6-13s)  Claim      "Serve una vista chiara."
 *  390-720 (13-24s) Vitals     Spark spread, ATR, correlation
 *  720-1020(24-34s) BigNumber  Margin Simulator: 7,42% margine
 *  1020-1350(34-45s)Chart      Forecast 12-24 mesi (con fan)
 *  1350-1590(45-53s)Grid       Report Builder / API / Alert / Backtest
 *  1590-1800(53-60s)CTA        energyindex.it/it/pro — €499/mese
 */
export function EidxPro() {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: FONT }}>
      {HAS_MUSIC && (
        <Audio src={staticFile("music.mp3")} volume={MUSIC_VOLUME} endAt={durationInFrames} />
      )}

      <Sequence from={0} durationInFrames={180}>
        <KeynoteTitle
          kicker="EIDX Pro"
          hero="Il mercato energy si muove ogni secondo."
          duration={180}
        />
      </Sequence>

      <Sequence from={180} durationInFrames={210}>
        <KeynoteTitle
          hero="Serve una vista chiara."
          duration={210}
        />
      </Sequence>

      <Sequence from={390} durationInFrames={330}>
        <CardsGrid
          kicker="Trading Vitals"
          hero="Ogni metrica che ti serve, in un pannello."
          columns={3}
          duration={330}
          cards={[
            { label: "Spark spread (clean)", value: "12,84", unit: "€/MWh", delta: "▲ 4,2%", deltaColor: theme.up, icon: "⚡" },
            { label: "PUN — ATR 30d", value: "18,3", unit: "€/MWh", delta: "vola. alta", deltaColor: theme.accent, icon: "📈" },
            { label: "PUN ↔ TTF corr.", value: "0,87", unit: "ρ", delta: "60d", deltaColor: theme.accent, icon: "🔗" },
            { label: "PSV — VaR 95%", value: "8,4", unit: "€/MWh", delta: "1d", deltaColor: theme.down, icon: "🛡" },
            { label: "Portfolio MTM", value: "1,24", unit: "M€", delta: "▲ 3,1%", deltaColor: theme.up, icon: "💼" },
            { label: "Stress test −3σ", value: "−412", unit: "k€", delta: "worst", deltaColor: theme.down, icon: "⚠" },
          ]}
        />
      </Sequence>

      <Sequence from={720} durationInFrames={300}>
        <BigNumber
          kicker="Margin Simulator"
          from={0}
          to={7.42}
          fractionDigits={2}
          unit="%"
          footnote="margine su offerta PUN fisso 24 mesi — benchmark real-time"
          duration={300}
        />
      </Sequence>

      <Sequence from={1020} durationInFrames={330}>
        <LineChartScene
          kicker="Forecast PUN — 24 mesi"
          title="Previsioni con scenari what-if."
          duration={330}
          yLabelSuffix=" €/MWh"
          points={[124, 118, 132, 141, 128, 119, 124, 138, 152, 145, 138, 128]}
          forecast={[135, 148, 156, 162, 158, 148, 138, 132, 128, 132, 138, 142]}
        />
      </Sequence>

      <Sequence from={1350} durationInFrames={240}>
        <ClaimsList
          kicker="Tutto integrato"
          hero="Dal dato grezzo al report firmato."
          duration={240}
          claims={[
            "Report Builder white-label (PDF, pitch deck).",
            "API programmatiche + alert email/webhook.",
            "Backtest engine e risk tools (Q3 2026).",
          ]}
        />
      </Sequence>

      <Sequence from={1590} durationInFrames={210}>
        <CtaEnd
          productName="EIDX Pro"
          url="energyindex.it/it/pro"
          kicker="Analytics professionali · da €499/mese · trial gratuito"
          duration={210}
        />
      </Sequence>
    </AbsoluteFill>
  );
}
