"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { LeadStatus } from "@/lib/admin/leads";
import { createServiceClient } from "@/lib/supabase/service";

const STATUSES: LeadStatus[] = ["nuovo", "contattato", "attivato", "scartato"];

/** Aggiorna stato e note di un lead. Solo per utenti admin. */
export async function updateLead(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "") as LeadStatus;
  const notes = formData.get("notes");
  if (!Number.isInteger(id) || !STATUSES.includes(status)) return;

  const supabase = createServiceClient();
  if (!supabase) return;
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (typeof notes === "string") patch.notes = notes.slice(0, 2000) || null;
  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) console.error("[updateLead]", error.message);
  revalidatePath("/it/admin");
}
