import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth";

/**
 * Chi puo' entrare in /it/admin: lista di email in ADMIN_EMAILS (separate
 * da virgola). Il login via link email e' permesso solo a questi indirizzi.
 */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "commerciale@deagroup.biz";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.trim().toLowerCase());
}

/** Utente admin loggato, altrimenti redirect al login. */
export async function requireAdmin() {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAdminEmail(data.user.email)) redirect("/it/admin/login");
  return data.user;
}
