import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiHeaders } from "@/lib/api/latest-price";
import { buildEnergyIndexJson, latestPerSlug, type AggregateRow } from "@/lib/api/energy-index";

/**
 * GET /api/v1/energy-index[?commodity=luce|gas]
 *
 * Ultimo snapshot dei 4 Energy Index delle offerte. Cache 6 ore: gli
 * aggregati si ricalcolano una volta al giorno.
 */
export const revalidate = 21600;

const headers = { ...apiHeaders, "Cache-Control": "public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400" };

export async function GET(request: NextRequest) {
  const c = request.nextUrl.searchParams.get("commodity");
  if (c !== null && c !== "luce" && c !== "gas") {
    return NextResponse.json(
      { error: "invalid_param", message: "commodity deve essere 'luce' o 'gas'." },
      { status: 400, headers },
    );
  }
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("energy_index_aggregates")
    .select("aggregate_slug, computed_at, median, p25, p75, min, max, sample_size, spread_vs_reference_pct, unit")
    .order("computed_at", { ascending: false })
    .limit(40);
  const json = buildEnergyIndexJson(latestPerSlug((data ?? []) as AggregateRow[]), c ?? undefined);
  if (json.indices.length === 0) {
    return NextResponse.json(
      { error: "no_data", message: "Nessun Energy Index disponibile.", attribution: json.attribution },
      { status: 503, headers },
    );
  }
  return NextResponse.json(json, { status: 200, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
