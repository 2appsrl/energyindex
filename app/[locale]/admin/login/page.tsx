import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Accesso admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>;
}) {
  const { errore } = await searchParams;
  return (
    <div className="container mx-auto flex min-h-[70dvh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-3xl border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-violet-600 text-white">
            <LockKeyhole className="size-6" />
          </span>
          <h1 className="text-2xl font-black">Area admin</h1>
          <p className="text-sm text-muted-foreground">Ricevi un link di accesso via email. Niente password.</p>
        </div>
        {errore && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600 dark:text-rose-400">
            Link non valido o scaduto. Richiedine uno nuovo.
          </p>
        )}
        <AdminLoginForm />
      </div>
    </div>
  );
}
