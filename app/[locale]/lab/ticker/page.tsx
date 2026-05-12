import type { Metadata } from "next";
import { MatrixHeatmap, type MockOffer } from "./MatrixHeatmap";

export const metadata: Metadata = {
  title: "Market Map — Lab",
  robots: { index: false, follow: false },
};

const VENDORS = [
  "A2A ENERGIA", "EDISON", "ENI PLENITUDE", "ENEL ENERGIA", "HERA COMM",
  "IREN MERCATO", "DAZE", "ACEA ENERGIA", "AGSM AIM", "OPENECONOMY",
  "TRENTA", "SORGENIA", "WEKIWI", "OCTOPUS", "GREEN NETWORK",
  "ESTRA", "BLUENERGY", "ABY POWER", "NEOENERGIA", "SUNCITY",
];

function generateMockOffers(
  category: string,
  prefix: string,
  median: number,
  count: number,
  spreadMode: boolean = false,
): MockOffer[] {
  const offers: MockOffer[] = [];
  for (let i = 0; i < count; i++) {
    const vendor =
      VENDORS[i % VENDORS.length] +
      (i >= VENDORS.length ? ` ${Math.floor(i / VENDORS.length) + 1}` : "");
    // Distribuzione skewed: molte offerte vicine alla mediana, coda lunga sopra
    const r = Math.random();
    const skewedMultiplier = r < 0.5 ? 0.4 + r * 1.2 : 1.0 + (r - 0.5) * 2.4;
    const price = median * skewedMultiplier;
    offers.push({
      vendor,
      codice: `${prefix}${String(i + 1).padStart(4, "0")}`,
      price,
      median,
      category,
      isSpread: spreadMode,
    });
  }
  return offers.sort((a, b) => a.price - b.price);
}

export default function TickerLabPage() {
  const luceFissa = generateMockOffers("Luce Fissa", "PLF", 0.34, 221);
  const luceVar = generateMockOffers("Luce Variabile", "PLV", 0.06, 254, true);
  const gasFissa = generateMockOffers("Gas Fisso", "PGF", 1.5, 209);
  const gasVar = generateMockOffers("Gas Variabile", "PGV", 0.3, 253, true);

  return (
    <MatrixHeatmap
      sections={[
        {
          title: "⚡ LUCE FISSA",
          unit: "€/kWh",
          offers: luceFissa,
        },
        {
          title: "⚡ LUCE VARIABILE (spread)",
          unit: "€/kWh",
          offers: luceVar,
        },
        {
          title: "🔥 GAS FISSA",
          unit: "€/Smc",
          offers: gasFissa,
        },
        {
          title: "🔥 GAS VARIABILE (spread)",
          unit: "€/Smc",
          offers: gasVar,
        },
      ]}
    />
  );
}
