import { NextResponse } from "next/server";
import { fetchLatestPrice, apiHeaders, ALL_ASSETS } from "@/lib/api/latest-price";

/**
 * GET /api/v1/today
 *
 * Endpoint pubblico JSON con TUTTI gli ultimi valori in una call: PUN,
 * PSV, TTF, Brent, CO2. Ottimizzato per dashboard / widget che vogliono
 * far vedere uno snapshot completo senza N round-trip.
 *
 * Schema:
 *  {
 *    "date": "2026-06-28",
 *    "values": {
 *       "PUN":   { ...stesso schema di /api/v1/pun/today },
 *       "PSV":   { ... },
 *       "TTF":   { ... },
 *       "Brent": { ... },
 *       "CO2":   { ... }
 *    },
 *    "attribution": "...",
 *    "source_page": "https://energyindex.it/it"
 *  }
 *
 * Note:
 *  - Gli asset senza dato disponibile vengono OMESSI (non null)
 *  - La data top-level e' quella del PUN (asset principale)
 */
export const revalidate = 900;

export async function GET() {
  const results = await Promise.all(ALL_ASSETS.map((slug) => fetchLatestPrice(slug)));
  const values: Record<string, ReturnType<typeof Object>> = {};
  let topDate: string | null = null;
  for (const r of results) {
    if (!r) continue;
    values[r.asset] = r;
    if (r.asset === "PUN") topDate = r.date;
  }
  if (Object.keys(values).length === 0) {
    return NextResponse.json(
      {
        error: "no_data",
        message: "Nessun dato disponibile al momento.",
        attribution: "Energy Index — https://energyindex.it",
      },
      { status: 503, headers: apiHeaders },
    );
  }
  return NextResponse.json(
    {
      date: topDate ?? new Date().toISOString().slice(0, 10),
      values,
      attribution: "Energy Index — https://energyindex.it (gratis, attribuzione richiesta)",
      source_page: "https://energyindex.it/it",
      docs: "https://energyindex.it/api/v1",
    },
    { status: 200, headers: apiHeaders },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiHeaders });
}
