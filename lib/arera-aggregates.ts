export type AggregateSlug =
  | "mercato-libero-luce-fissa"
  | "mercato-libero-luce-variabile"
  | "mercato-libero-gas-fissa"
  | "mercato-libero-gas-variabile";

export type Commodity = "electricity" | "gas";
export type PriceType = "fisso" | "variabile";

export interface AggregateDefinition {
  slug: AggregateSlug;
  commodity: Commodity;
  priceType: PriceType;
  /** Unita' di misura del prezzo retail comparabile. */
  unit: string;
  /** Nome lungo per heading/card title. */
  displayName: string;
  /** Etichetta corta per legenda chart. */
  displayShort: string;
  /** Asset wholesale di riferimento per spread/comparison. */
  referenceAssetSlug: string;
}

export const AGGREGATE_SLUGS: readonly AggregateDefinition[] = [
  {
    slug: "mercato-libero-luce-fissa",
    commodity: "electricity",
    priceType: "fisso",
    unit: "€/kWh",
    displayName: "Luce — Prezzo Fisso",
    displayShort: "Luce fissa",
    referenceAssetSlug: "pun",
  },
  {
    slug: "mercato-libero-luce-variabile",
    commodity: "electricity",
    priceType: "variabile",
    unit: "€/kWh",
    displayName: "Luce — Prezzo Variabile",
    displayShort: "Luce variabile",
    referenceAssetSlug: "pun",
  },
  {
    slug: "mercato-libero-gas-fissa",
    commodity: "gas",
    priceType: "fisso",
    unit: "€/Smc",
    displayName: "Gas — Prezzo Fisso",
    displayShort: "Gas fisso",
    referenceAssetSlug: "psv",
  },
  {
    slug: "mercato-libero-gas-variabile",
    commodity: "gas",
    priceType: "variabile",
    unit: "€/Smc",
    displayName: "Gas — Prezzo Variabile",
    displayShort: "Gas variabile",
    referenceAssetSlug: "psv",
  },
] as const;

const BY_SLUG = new Map<string, AggregateDefinition>(
  AGGREGATE_SLUGS.map((a) => [a.slug, a]),
);

export function resolveAggregate(slug: string): AggregateDefinition {
  const a = BY_SLUG.get(slug);
  if (!a) throw new Error(`unknown aggregate slug: ${slug}`);
  return a;
}
