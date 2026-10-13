import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** Tutto cio' che sta sotto (dash) richiede un utente admin. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <div className="container mx-auto px-4 py-8">{children}</div>;
}
