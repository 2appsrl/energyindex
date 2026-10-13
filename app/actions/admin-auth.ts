"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth";
import { isAdminEmail } from "@/lib/admin/auth";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

/**
 * Invia il link di accesso all'area admin. Il link parte solo per gli
 * indirizzi in ADMIN_EMAILS, ma la risposta e' identica in ogni caso:
 * dal form non si deve poter capire quali email sono abilitate.
 */
export async function sendAdminMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Indirizzo email non valido." };
  }

  if (isAdminEmail(email)) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "energyindex.it";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${proto}://${host}/it/admin/auth/callback`, shouldCreateUser: true },
    });
    if (error) {
      console.error("[sendAdminMagicLink]", error.message);
      return { status: "error", message: "Invio non riuscito, riprova tra qualche minuto." };
    }
  }

  return { status: "sent", message: "Se l'indirizzo e' abilitato, riceverai a breve un link di accesso." };
}

export async function adminLogout() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/it/admin/login");
}
