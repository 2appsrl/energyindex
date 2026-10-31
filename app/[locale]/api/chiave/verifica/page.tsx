import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ActivateKeyForm } from "@/components/api/ActivateKeyForm";

export const metadata: Metadata = {
  title: "Attiva la chiave API",
  description: "Conferma la richiesta della chiave Developer delle API Energy Index.",
  // Pagina con token nell'URL: fuori dagli indici e senza Referer verso i link in uscita.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Pagina di atterraggio del link di verifica. Sul GET non succede niente:
 * l'attivazione parte solo dal pulsante (POST di una server action), cosi'
 * gli scanner delle email che aprono i link in anticipo non consumano il token.
 */
export default async function VerificaChiavePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.trim() : "";

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12 space-y-6">
      <Link
        href="/it/api"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> API Energy Index
      </Link>
      <div className="rounded-2xl border bg-card p-8 space-y-5">
        <div className="flex items-center gap-3">
          <KeyRound className="size-8 text-violet-600 dark:text-violet-400" />
          <h1 className="text-2xl font-black">Attiva la chiave Developer</h1>
        </div>
        {token ? (
          <ActivateKeyForm token={token} />
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-rose-600 dark:text-rose-400">
              Link incompleto: apri il link che ti abbiamo mandato per email, per intero.
            </p>
            <p className="text-muted-foreground">
              Se il link è scaduto,{" "}
              <Link href="/it/api#chiave" className="font-semibold text-violet-600 underline dark:text-violet-400">
                ripeti la richiesta
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
