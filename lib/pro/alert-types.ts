/**
 * Wave 4 — Alert & API. Pure types per la configurazione alert client-side.
 * No math, no I/O. La persistenza nel demo e' localStorage; al lancio Q3 2026
 * sara' una tabella Supabase con RLS per user_id + edge function di valutazione
 * trigger via pg_cron + invio email/webhook via Resend.
 */

export type AlertAsset = "pun" | "psv" | "ttf" | "spark";
export type AlertCondition = "above" | "below";
export type AlertDestination = "email" | "slack" | "webhook";

export interface AlertConfig {
  /** uuid client-side (crypto.randomUUID()) */
  id: string;
  asset: AlertAsset;
  condition: AlertCondition;
  /** soglia in EUR/MWh (per spark spread idem) */
  thresholdEurPerMwh: number;
  destination: AlertDestination;
  /** ISO timestamp */
  createdAt: string;
  active: boolean;
}

export const ASSET_LABELS: Record<AlertAsset, string> = {
  pun: "PUN",
  psv: "PSV",
  ttf: "TTF",
  spark: "Spark Spread",
};

export const CONDITION_LABELS: Record<AlertCondition, string> = {
  above: "sopra",
  below: "sotto",
};

export const DESTINATION_LABELS: Record<AlertDestination, string> = {
  email: "Email",
  slack: "Slack",
  webhook: "Webhook",
};

/** Locked nel demo — utente vede il chip ma non puo' selezionare */
export const LOCKED_DESTINATIONS: AlertDestination[] = ["slack", "webhook"];
