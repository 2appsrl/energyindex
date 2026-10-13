import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase per l'autenticazione (area admin). A differenza di
 * lib/supabase/server.ts scrive i cookie di sessione: funziona in Server
 * Action e Route Handler. Nei server component la scrittura fallisce ed
 * e' ignorata: li' la sessione la rinnova il middleware.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) cookieStore.set(name, value, options);
          } catch {
            // Server component: cookie in sola lettura.
          }
        },
      },
    },
  );
}
