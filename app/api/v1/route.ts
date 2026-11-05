import { NextResponse } from "next/server";
import { API_EXPOSE_HEADERS } from "@/lib/api-keys/gate";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": API_EXPOSE_HEADERS,
} as const;

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
      docs: "https://energyindex.it/it/api/docs",
      openapi: "https://energyindex.it/api/v1/openapi.json",
      plans: "https://energyindex.it/it/api#piani",
      attribution_required: true,
      attribution_text: "Fonte: Energy Index (https://energyindex.it)",
      license:
        "PUN and PSV are not for sale: shown free of charge for information. Paid plans cover additional services. Energy Index elaborations: free, including commercial use, with attribution. Source data (GME, ICE Endex, EIA, EEX) remain subject to the source's terms: commercial use of GME data requires GME's written authorization.",
      license_url: "https://energyindex.it/it/api/docs#licenza",
      cache:
        "15 minutes for PUN, PSV and /today; 6 hours for /energy-index. With stale-while-revalidate, the first request after expiry may still get the previous value while the cache refreshes.",
      widget: "https://energyindex.it/it/api/widget",
      cors: "* (Access-Control-Allow-Origin)",
      auth:
        "Optional on live (Open) endpoints. Key: header Authorization: Bearer eidx_live_… (?key= accepted but discouraged). From a browser a key works only from its registered domain (Origin); server calls without Origin are allowed. Errors: 401 invalid_key, 403 origin_not_allowed.",
      rate_limit:
        "60/min per IP; with a key, the plan's limit (header X-RateLimit-Limit), at most 120/min on GME data paths whatever the plan. Enforced over 5-minute windows: above 5x the per-minute limit, 429 rate_limited with Retry-After: 900 for 15 minutes.",
      key_request: "https://energyindex.it/it/api#chiave",
      endpoints: [
        {
          path: "/api/v1/pun/today",
          method: "GET",
          description: "PUN (fonte GME): media del giorno in value, ultima ora pubblicata in last_hour",
          example_response: {
            date: "2026-10-30",
            observed_at: "2026-10-29T23:00:00.000Z",
            value: 0.27404,
            unit: "€/kWh",
            value_native: 274.04,
            unit_native: "€/MWh",
            granularity: "daily",
            last_hour: { date: "2026-10-30", hour: 24, observed_at: "2026-10-30T22:00:00+00:00", value: 0.25012, unit: "€/kWh", value_native: 250.12, unit_native: "€/MWh" },
            daily_average: { date: "2026-10-30", value: 0.27404, unit: "€/kWh", value_native: 274.04, unit_native: "€/MWh", hours: 24 },
            asset: "PUN",
            asset_name: "Prezzo Unico Nazionale energia elettrica Italia",
            source: "GME",
            source_url: "https://www.mercatoelettrico.org",
            source_terms_url: "https://www.mercatoelettrico.org/en-us/Home/TermsOfUse",
            attribution: "Fonte: Gestore dei Mercati Energetici S.p.A. — via Energy Index (https://energyindex.it)",
            page: "https://energyindex.it/it/indice/pun",
          },
        },
        {
          path: "/api/v1/psv/today",
          method: "GET",
          description: "Ultimo prezzo di riferimento MGP-GAS (PSV, fonte GME) per il giorno gas di consegna",
          example_response: {
            date: "2026-10-29",
            observed_at: "2026-10-28T23:00:00+00:00",
            value: 0.10558,
            unit: "€/kWh",
            value_native: 105.58,
            unit_native: "€/MWh",
            granularity: "daily",
            gas_day: "2026-10-29",
            session_date: "2026-10-28",
            product: "MGP-2026-10-29",
            asset: "PSV",
            asset_name: "PSV — prezzo di riferimento MGP-GAS (GME), prodotto giornaliero",
            source: "GME",
            source_url: "https://www.mercatoelettrico.org/it-it/Home/Esiti/Gas/MGP/Esiti",
            source_terms_url: "https://www.mercatoelettrico.org/en-us/Home/TermsOfUse",
            attribution: "Fonte: Gestore dei Mercati Energetici S.p.A. — via Energy Index (https://energyindex.it)",
            page: "https://energyindex.it/it/indice/psv",
          },
        },
        {
          path: "/api/v1/energy-index",
          method: "GET",
          description:
            "Energy Index delle offerte del mercato libero (Portale Offerte ARERA): mediana, quartili e range per luce e gas, fisse e variabili. Per le variabili (basis spread) le statistiche sono lo spread sopra reference (PUN o PSV). Filtro opzionale ?commodity=luce|gas.",
          example_response: {
            updated_at: "2026-10-30",
            indices: [
              { slug: "mercato-libero-luce-fissa", commodity: "luce", price_type: "fisso", basis: "prezzo", unit: "€/kWh", median: 0.3495, offers: 230 },
              { slug: "mercato-libero-luce-variabile", commodity: "luce", price_type: "variabile", basis: "spread", reference: "PUN", unit: "€/kWh", median: 0.055, offers: 262 },
            ],
            source: "ARERA — Portale Offerte",
            attribution: "Fonte: Energy Index (https://energyindex.it) — elaborazione su dati Portale Offerte ARERA",
            page: "https://energyindex.it/it/mercato-libero",
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
    { status: 200, headers },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
