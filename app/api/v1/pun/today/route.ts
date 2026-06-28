import { NextResponse } from "next/server";
import { fetchLatestPrice, apiHeaders } from "@/lib/api/latest-price";

/**
 * GET /api/v1/pun/today
 *
 * Endpoint pubblico JSON con l'ultimo PUN osservato (€/kWh + €/MWh nativo).
 * Cache 15 min, CORS aperto, attribuzione richiesta nella response.
 *
 * Schema:
 *  {
 *    "date": "2026-06-28",
 *    "observed_at": "2026-06-28T11:30:00Z",
 *    "value": 0.13245,         // €/kWh (consumer-friendly)
 *    "unit": "€/kWh",
 *    "value_native": 132.45,   // €/MWh (formato GME nativo)
 *    "unit_native": "€/MWh",
 *    "asset": "PUN",
 *    "asset_name": "Prezzo Unico Nazionale energia elettrica Italia",
 *    "source": "GME",
 *    "source_url": "https://www.mercatoelettrico.org",
 *    "attribution": "Energy Index — https://energyindex.it (gratis, attribuzione richiesta)",
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
