import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase con la service role key: bypassa RLS. Solo per codice
 * server che ha gia' verificato i permessi (dashboard admin, salvataggio
 * lead dai form). Mai importare da componenti client.
 *
 * Ritorna null se la chiave non e' configurata, cosi' chi lo usa puo'
 * degradare invece di rompere la pagina.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
