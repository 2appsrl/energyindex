"use client";

import { useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

type LockedFeature = "pdf" | "save";

export function SimulatorActions() {
  const [showLockModal, setShowLockModal] = useState<LockedFeature | null>(null);
  const [copied, setCopied] = useState(false);

  function handleShare() {
    if (typeof window === "undefined") return;
    try {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      trackEvent("eidx_pro_simulator_share");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non disponibile (es. http insicuro) — silenzioso
    }
  }

  function handleLocked(which: LockedFeature) {
    setShowLockModal(which);
    trackEvent("eidx_pro_simulator_locked_click", { feature: which });
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={() => handleLocked("pdf")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors text-sm"
        >
          <span aria-hidden>🔒</span> Esporta PDF
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors text-sm"
        >
          {copied ? "✓ Link copiato" : "Condividi link"}
        </button>
        <button
          type="button"
          onClick={() => handleLocked("save")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0a3d2e] text-white hover:bg-[#0a3d2e]/90 transition-colors text-sm font-semibold"
        >
          <span aria-hidden>🔒</span> Salva scenario
        </button>
      </div>

      {showLockModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowLockModal(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lock-modal-title"
          >
            <h3 id="lock-modal-title" className="text-lg font-bold text-stone-900">
              {showLockModal === "pdf" ? "Esporta PDF" : "Salva scenario"} &mdash; funzione Pro
            </h3>
            <p className="text-sm text-stone-600">
              Questa funzione e&apos; disponibile nei piani EIDX Pro (149€/mese) ed
              Enterprise. Registrati al lancio per accesso prioritario e pricing
              early-bird.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowLockModal(null)}
                className="px-4 py-2 rounded-md border border-stone-300 text-sm text-stone-700 hover:bg-stone-50"
              >
                Chiudi
              </button>
              <Link
                href="/it/pro#early-access"
                className="px-4 py-2 rounded-md bg-[#0a3d2e] text-white text-sm font-semibold hover:bg-[#0a3d2e]/90"
              >
                Avvisami al lancio
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
