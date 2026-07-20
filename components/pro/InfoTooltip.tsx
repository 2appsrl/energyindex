"use client";

import { Info } from "lucide-react";
import { useState } from "react";

/**
 * Small accessible tooltip used to explain KPI cards and section headers
 * in the EIDX Pro simulator. Opens on hover, focus, or click. Closes on
 * mouse leave, blur, or a second click.
 */
export function InfoTooltip({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center align-middle ml-1.5">
      <button
        type="button"
        aria-label={`Spiegazione: ${label}`}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="text-stone-400 hover:text-stone-600 transition-colors cursor-help"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-30 left-1/2 -translate-x-1/2 top-full mt-2 w-64 max-w-[16rem] rounded-lg bg-stone-900 text-white text-xs leading-relaxed p-3 shadow-xl pointer-events-none"
          style={{ whiteSpace: "normal" }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
