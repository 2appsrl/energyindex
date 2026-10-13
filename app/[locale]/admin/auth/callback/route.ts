import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/auth";
import { isAdminEmail } from "@/lib/admin/auth";

/**
 * Atterraggio del link email di accesso admin. Supporta sia il flusso PKCE
 * (?code=, default di @supabase/ssr) sia ?token_hash=&type= se il template
 * email di Supabase viene personalizzato.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createAuthClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (ok) {
    const { data } = await supabase.auth.getUser();
    if (isAdminEmail(data.user?.email)) return NextResponse.redirect(new URL("/it/admin", origin));
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/it/admin/login?errore=link", origin));
}
