"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { MAIL_CATEGORIES, MAIL_STATUSES, type MailCategory, type MailStatus } from "@/lib/mail/types";
import { createServiceClient } from "@/lib/supabase/service";

/** Salva stato, categoria corretta a mano e bozza modificata. Solo per utenti admin. */
export async function updateInboundEmail(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const status = formData.get("status");
  if (MAIL_STATUSES.includes(status as MailStatus)) patch.status = status;
  const category = formData.get("category");
  if (MAIL_CATEGORIES.includes(category as MailCategory)) patch.category = category;
  const draft = formData.get("reply_draft");
  if (typeof draft === "string") patch.reply_draft = draft.slice(0, 20_000) || null;

  const supabase = createServiceClient();
  if (!supabase) return;
  const { error } = await supabase.from("inbound_emails").update(patch).eq("id", id);
  if (error) console.error("[updateInboundEmail]", error.message);
  revalidatePath("/it/admin");
}
