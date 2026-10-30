import { NextResponse } from "next/server";
import { fetchLatestPrice, apiHeaders } from "@/lib/api/latest-price";

/**
 * GET /api/v1/psv/today
 *
 * Endpoint pubblico JSON con l'ultimo prezzo di riferimento MGP-GAS del GME
 * (prodotto giornaliero, €/kWh + €/MWh nativo). Schema di /api/v1/pun/today
 * con, al posto di hour/daily_average: `date` = `gas_day` (giorno gas di
 * consegna), `session_date` (sessione di negoziazione) e `product`
 * ("MGP-YYYY-MM-DD").
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
