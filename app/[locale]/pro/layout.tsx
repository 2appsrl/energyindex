import type { ReactNode } from "react";

/**
 * Layout per la sezione EIDX Pro.
 *
 * Imposta `data-theme="pro-light"` per forzare il tema chiaro (override
 * dei CSS tokens in app/globals.css) anche quando il global toggle e'
 * su dark. Sfondo cream warm caratteristico del brand Pro.
 *
 * Il custom EidxProHeader viene renderizzato dalle singole pagine che
 * sopprimono il global SiteHeader (vedi components/site-header.tsx).
 */
export default function ProLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="pro-light"
      className="min-h-[calc(100dvh-3.5rem)] bg-[#f5f3ee] text-stone-900"
    >
      {children}
    </div>
  );
}
