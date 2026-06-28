import { NextResponse } from "next/server";

/**
 * GET /api/v1
 *
 * Documentazione API pubblica (JSON discoverabile). Tipo di "service index"
 * minimale che descrive gli endpoint disponibili — utile sia per umani
 * (curl /api/v1) sia per agenti AI che fetchano l'indice prima di chiamare.
 */
export async function GET() {
  return NextResponse.json(
    {
      api: "Energy Index",
      version: "v1",
      base_url: "https://energyindex.it/api/v1",
      docs: "https://energyindex.it/api/v1",
      attribution_required: true,
      attribution_text: "Fonte: Energy Index (https://energyindex.it)",
      license: "free for personal & commercial use with attribution",
      cache: "15 minuti (Cache-Control: public, max-age=900, s-maxage=900, stale-while-revalidate=3600)",
      cors: "* (Access-Control-Allow-Origin)",
      rate_limit: "none (best-effort, abuse may trigger throttling)",
      endpoints: [
        {
          path: "/api/v1/pun/today",
          method: "GET",
          description: "Ultimo valore PUN (Prezzo Unico Nazionale energia elettrica Italia, fonte GME)",
          example_response: {
            date: "2026-06-28",
            observed_at: "2026-06-28T11:30:00.000Z",
            value: 0.13245,
            unit: "€/kWh",
            value_native: 132.45,
            unit_native: "€/MWh",
            asset: "PUN",
            asset_name: "Prezzo Unico Nazionale energia elettrica Italia",
            source: "GME",
            source_url: "https://www.mercatoelettrico.org",
            attribution: "Energy Index — https://energyindex.it (gratis, attribuzione richiesta)",
            page: "https://energyindex.it/it/indice/pun",
          },
        },
        {
          path: "/api/v1/psv/today",
          method: "GET",
          description: "Ultimo valore PSV (Punto di Scambio Virtuale gas naturale Italia, fonte GME)",
          example_response: {
            date: "2026-06-28",
            observed_at: "2026-06-28T17:00:00.000Z",
            value: 0.03618,
            unit: "€/kWh",
            value_native: 36.18,
            unit_native: "€/MWh",
            asset: "PSV",
            asset_name: "Punto di Scambio Virtuale gas naturale Italia",
            source: "GME",
            source_url: "https://www.mercatoelettrico.org",
            attribution: "Energy Index — https://energyindex.it (gratis, attribuzione richiesta)",
            page: "https://energyindex.it/it/indice/psv",
          },
        },
        {
          path: "/api/v1/today",
          method: "GET",
          description: "Snapshot di TUTTI gli indici in una call: PUN, PSV, TTF, Brent, CO2",
          example_response: {
            date: "2026-06-28",
            values: {
              PUN: { /* same schema as /api/v1/pun/today */ },
              PSV: { /* ... */ },
              TTF: { /* ... */ },
              Brent: { /* ... */ },
              CO2: { /* ... */ },
            },
            attribution: "Energy Index — https://energyindex.it",
            source_page: "https://energyindex.it/it",
          },
        },
      ],
      attribution_examples: {
        html: '<p>Fonte: <a href="https://energyindex.it" target="_blank" rel="noopener">Energy Index</a></p>',
        markdown: "Fonte: [Energy Index](https://energyindex.it)",
        plain: "Fonte: Energy Index (https://energyindex.it)",
      },
      contact: "pro@energyindex.pro",
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
