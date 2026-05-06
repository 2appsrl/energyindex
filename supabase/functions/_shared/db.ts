import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2.39.0";

export function dbServiceRole(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function refreshLatestPriceView(db: SupabaseClient): Promise<void> {
  const { error } = await db.rpc("refresh_latest_price_view");
  if (error) throw new Error(`refresh_latest_price_view: ${error.message}`);
}
