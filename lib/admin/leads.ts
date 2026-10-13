import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export type LeadSource = "api_key" | "contact";
export type LeadStatus = "nuovo" | "contattato" | "attivato" | "scartato";

export interface LeadInput {
  source: LeadSource;
  nome?: string;
  email: string;
  azienda?: string;
  piano?: string;
  oggetto?: string;
  messaggio?: string;
}

/**
 * Salva un lead nella tabella leads. Non lancia mai: il form deve comunque
 * mandare l'email anche se il DB non risponde o la migrazione non e' ancora
 * applicata.
 */
export async function saveLead(input: LeadInput): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;
  try {
    const { error } = await supabase.from("leads").insert(input);
    if (error) console.error("[saveLead]", error.message);
  } catch (err) {
    console.error("[saveLead]", err);
  }
}
