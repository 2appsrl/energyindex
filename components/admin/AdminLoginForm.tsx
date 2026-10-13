"use client";

import { useActionState } from "react";
import { Loader2, Mail } from "lucide-react";
import { sendAdminMagicLink, type LoginState } from "@/app/actions/admin-auth";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendAdminMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center text-sm">
        <Mail className="mx-auto mb-2 size-6 text-emerald-500" />
        {state.message}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="admin-email" className="block text-sm font-medium">
        Email
      </label>
      <input
        id="admin-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      />
      {state.status === "error" && <p className="text-sm text-rose-600 dark:text-rose-400">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Inviami il link
      </button>
    </form>
  );
}
