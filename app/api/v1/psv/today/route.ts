import { NextResponse } from "next/server";
import { fetchLatestPrice, apiHeaders } from "@/lib/api/latest-price";

/**
 * GET /api/v1/psv/today
 *
 * Endpoint pubblico JSON con l'ultimo PSV osservato (€/kWh + €/MWh nativo).
 * Schema identico a /api/v1/pun/today.
 */
export const revalidate = 900;

export async function GET() {
  const data = await fetchLatestPrice("psv");
  if (!data) {
    return NextResponse.json(
      {
        error: "no_data",
        message: "Nessuna osservazione PSV disponibile.",
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
