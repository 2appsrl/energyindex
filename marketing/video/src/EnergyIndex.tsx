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
 * Energy Index — 60s consumer promo.
 * Structure (30fps, 1800 frames total):
 *  0-180   (0-6s)   Hook       "Sai davvero quanto costa la luce oggi?"
 *  180-420 (6-14s)  BigNumber  PUN count-up to €/kWh
 *  420-720 (14-24s) CardsGrid  PUN + PSV + Mercato Libero medians
 *  720-1080(24-36s) CardsGrid  Driver di mercato: Brent, CO2, Temperatura
 *  1080-1380(36-46s)Chart      PUN 5y historical
 *  1380-1620(46-54s)Claims     Value props
 *  1620-1800(54-60s)CTA        energyindex.it
 */
export function EnergyIndex() {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: FONT }}>
      {HAS_MUSIC && (
        <Audio src={staticFile("music.mp3")} volume={MUSIC_VOLUME} endAt={durationInFrames} />
      )}

      <Sequence from={0} durationInFrames={180}>
        <KeynoteTitle
          kicker="Energy Index"
          hero="Sai davvero quanto costa la luce oggi?"
          duration={180}
        />
      </Sequence>

      <Sequence from={180} durationInFrames={240}>
        <BigNumber
          kicker="PUN — Prezzo Unico Nazionale"
          from={0}
          to={0.124}
          fractionDigits={4}
          unit="€/kWh"
          footnote="aggiornato ogni ora dal GME"
          duration={240}
        />
      </Sequence>

      <Sequence from={420} durationInFrames={300}>
        <CardsGrid
          kicker="I due riferimenti che contano"
          hero="PUN e PSV, in tempo reale."
          columns={3}
          duration={300}
          cards={[
            { label: "PUN (luce)", value: "0,124", unit: "€/kWh", delta: "▲ 2,1%", deltaColor: theme.up, icon: "⚡" },
            { label: "PSV (gas)", value: "0,378", unit: "€/Smc", delta: "▼ 0,8%", deltaColor: theme.down, icon: "🔥" },
            { label: "Offerta migliore luce", value: "0,102", unit: "€/kWh", delta: "500+ offerte", deltaColor: theme.accent, icon: "🏷" },
          ]}
        />
      </Sequence>

      <Sequence from={720} durationInFrames={360}>
        <CardsGrid
          kicker="Cosa muove il mercato"
          hero="I tre driver che decidono il prezzo."
          columns={3}
          duration={360}
          cards={[
            { label: "Brent", value: "68,42", unit: "$/bbl", delta: "▲ 0,8%", deltaColor: theme.up, icon: "🛢" },
            { label: "CO2 EUA", value: "71,20", unit: "€/tCO2", delta: "▼ 1,2%", deltaColor: theme.down, icon: "🌿" },
            { label: "Temperatura Italia", value: "19,5", unit: "°C", delta: "+2,3 °C", deltaColor: theme.up, icon: "🌡" },
          ]}
        />
      </Sequence>

      <Sequence from={1080} durationInFrames={300}>
        <LineChartScene
          kicker="PUN — Storico 5 anni"
          title="Vedi da dove viene il prezzo."
          duration={300}
          yLabelSuffix=" €/MWh"
          points={[45, 52, 61, 78, 95, 124, 178, 245, 312, 285, 210, 165, 140, 128, 115, 108, 102, 118, 132, 141, 128, 119, 124]}
        />
      </Sequence>

      <Sequence from={1380} durationInFrames={240}>
        <ClaimsList
          kicker="Perché Energy Index"
          hero="Prezzi ufficiali. Aggiornati ogni ora."
          duration={240}
          claims={[
            "Fonti pubbliche: GME, ARERA, EIA, Ember.",
            "500+ offerte del mercato libero confrontate ogni giorno.",
            "Gratis, senza registrazione.",
          ]}
        />
      </Sequence>

      <Sequence from={1620} durationInFrames={180}>
        <CtaEnd
          productName="Energy Index"
          url="energyindex.it"
          kicker="Prezzi luce e gas in tempo reale"
          duration={180}
        />
      </Sequence>
    </AbsoluteFill>
  );
}
