import { NextResponse } from "next/server";
import { fetchLatestPrice, apiHeaders } from "@/lib/api/latest-price";

/**
 * GET /api/v1/pun/today
 *
 * Endpoint pubblico JSON con il PUN: `value` e' la media del giorno italiano,
 * `last_hour` l'ultima ora pubblicata dal GME.
 * Cache 15 min, CORS aperto, attribuzione richiesta nella response.
 *
 * Schema:
 *  {
 *    "date": "2026-10-30",
 *    "observed_at": "2026-10-29T23:00:00.000Z",
 *    "value": 0.27404,         // €/kWh, media del giorno `date`
 *    "unit": "€/kWh",
 *    "value_native": 274.04,   // €/MWh (formato GME nativo)
 *    "unit_native": "€/MWh",
 *    "granularity": "daily",
 *    "last_hour": { "date": "2026-10-30", "hour": 24, "observed_at": "2026-10-30T22:00:00+00:00",
 *                   "value": 0.25012, "unit": "€/kWh", "value_native": 250.12, "unit_native": "€/MWh" },
 *    "daily_average": { "date": "2026-10-30", "value": 0.27404, "unit": "€/kWh",
 *                       "value_native": 274.04, "unit_native": "€/MWh", "hours": 24 },
 *    "asset": "PUN",
 *    "asset_name": "Prezzo Unico Nazionale energia elettrica Italia",
 *    "source": "GME",
 *    "source_url": "https://www.mercatoelettrico.org",
 *    "source_terms_url": "https://www.mercatoelettrico.org/en-us/Home/TermsOfUse",
 *    "attribution": "Fonte: Gestore dei Mercati Energetici S.p.A. — via Energy Index (https://energyindex.it)",
 *    "page": "https://energyindex.it/it/indice/pun"
 *  }
 */
export const revalidate = 900; // 15 minuti

export async function GET() {
  const data = await fetchLatestPrice("pun");
  if (!data) {
    return NextResponse.json(
      {
        error: "no_data",
        message: "Nessuna osservazione PUN disponibile.",
        attribution: "Energy Index — https://energyindex.it",
      },
      { status: 503, headers: apiHeaders },
    );
  }
  return NextResponse.json(data, { status: 200, headers: apiHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiHeaders });
}
