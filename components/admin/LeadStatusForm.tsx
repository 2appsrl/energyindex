"use client";

import { useRef } from "react";
import { updateLead } from "@/app/actions/admin-leads";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/admin/leads";

const STYLE: Record<LeadStatus, string> = {
  nuovo: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  contattato: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  attivato: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  scartato: "bg-muted text-muted-foreground",
};

/** Cambio stato del lead: salva appena si sceglie un valore. */
export function LeadStatusForm({ id, status, notes }: { id: number; status: LeadStatus; notes: string | null }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={updateLead} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => ref.current?.requestSubmit()}
        aria-label="Stato del lead"
        className={cn("rounded-md border-0 px-2 py-1 text-xs font-bold ring-1 ring-border", STYLE[status])}
      >
        <option value="nuovo">Nuovo</option>
        <option value="contattato">Contattato</option>
        <option value="attivato">Attivato</option>
        <option value="scartato">Scartato</option>
      </select>
      <textarea
        name="notes"
        defaultValue={notes ?? ""}
        placeholder="Note"
        rows={2}
        onBlur={(e) => {
          if (e.currentTarget.value !== (notes ?? "")) ref.current?.requestSubmit();
        }}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
      />
    </form>
  );
}
