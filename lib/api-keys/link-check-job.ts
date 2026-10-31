/**
 * Ciclo della verifica settimanale dell'attribuzione, senza I/O: lo script
 * scripts/check-attribution-links.ts gli passa il DB, il fetch e Resend.
 *
 * Per ogni chiave: il link c'e' se la pagina dichiarata contiene un <a> verso
 * energyindex.it oppure se il widget e' stato chiamato da quel dominio di
 * recente (il widget non funziona senza il link). Due fallimenti consecutivi
 * declassano la chiave ai limiti Open (vedi nextLinkState).
 */

import { nextLinkState, type KeyStatus } from "./link-check";

export interface CheckableKey {
  id: string;
  email: string;
  nome: string;
  domain: string;
  attribution_url: string;
  status: KeyStatus;
  link_failures: number;
}

export interface LinkCheckPatch {
  status: KeyStatus;
  link_failures: number;
  link_ok: boolean;
  link_checked_at: string;
}

export type LinkNotice = "downgraded" | "restored";

export interface LinkCheckDeps {
  hasLink(url: string): Promise<boolean>;
  widgetSeen(domain: string): Promise<boolean>;
  update(key: CheckableKey, patch: LinkCheckPatch): Promise<void>;
  notify(key: CheckableKey, kind: LinkNotice): Promise<void>;
  now?: () => Date;
  log?: (msg: string) => void;
}

export interface LinkCheckSummary {
  checked: number;
  ok: number;
  failed: number;
  downgraded: number;
  restored: number;
  /** Chiavi che non e' stato possibile verificare o aggiornare. */
  errors: number;
  /** Email non partite (lo stato della chiave e' comunque salvato). */
  notifyErrors: number;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function runLinkChecks(keys: CheckableKey[], deps: LinkCheckDeps): Promise<LinkCheckSummary> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((m: string) => console.error(m));
  const s: LinkCheckSummary = { checked: 0, ok: 0, failed: 0, downgraded: 0, restored: 0, errors: 0, notifyErrors: 0 };

  for (const k of keys) {
    s.checked++;
    let notice: LinkNotice | null;
    let ok: boolean;
    try {
      ok = (await deps.hasLink(k.attribution_url)) || (await deps.widgetSeen(k.domain));
      const next = nextLinkState({ status: k.status, link_failures: k.link_failures }, ok);
      await deps.update(k, {
        status: next.status,
        link_failures: next.link_failures,
        link_ok: ok,
        link_checked_at: now().toISOString(),
      });
      notice = next.notify;
    } catch (e) {
      s.errors++;
      log(`[link-check] chiave ${k.id} (${k.domain}): ${message(e)}`);
      continue;
    }

    if (ok) s.ok++;
    else s.failed++;
    if (notice === "downgraded") s.downgraded++;
    if (notice === "restored") s.restored++;

    if (notice) {
      try {
        await deps.notify(k, notice);
      } catch (e) {
        s.notifyErrors++;
        log(`[link-check] email ${notice} per ${k.id} (${k.domain}): ${message(e)}`);
      }
    }
  }
  return s;
}

/** Il nome arriva da un form: niente a capo nel testo (difesa a costo zero). */
function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

export function linkCheckEmail(k: CheckableKey, kind: LinkNotice): { subject: string; text: string } {
  const nome = oneLine(k.nome);
  if (kind === "downgraded") {
    return {
      subject: "Chiave API Energy Index: manca l'attribuzione",
      text:
        `Ciao ${nome},\n\n` +
        `da due settimane non troviamo il link "Fonte: Energy Index" su ${k.attribution_url}. ` +
        `La chiave per ${k.domain} funziona ancora, ma con i limiti del piano Open.\n\n` +
        `Rimetti il link (https://energyindex.it) e alla prossima verifica torna attiva.`,
    };
  }
  return {
    subject: "Chiave API Energy Index riattivata",
    text:
      `Ciao ${nome},\n\n` +
      `abbiamo ritrovato il link di attribuzione su ${k.attribution_url}: ` +
      `la chiave per ${k.domain} è di nuovo attiva con i limiti Developer. Grazie!`,
  };
}
