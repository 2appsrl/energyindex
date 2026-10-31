/**
 * Ciclo della verifica settimanale dell'attribuzione, senza I/O: lo script
 * scripts/check-attribution-links.ts gli passa il DB, il fetch e Resend.
 *
 * Per ogni chiave: il link c'e' se la pagina dichiarata contiene un <a> verso
 * energyindex.it oppure se il widget e' stato chiamato da quel dominio di
 * recente (il widget non funziona senza il link). Due fallimenti consecutivi
 * declassano la chiave ai limiti Open (vedi nextLinkState).
 */

import { hostMatchesDomain } from "./keys";
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
  /**
   * Salva il nuovo stato solo se la chiave ha ancora lo stato letto all'inizio.
   * false = nessuna riga aggiornata (es. revocata durante il giro).
   */
  update(key: CheckableKey, patch: LinkCheckPatch): Promise<boolean>;
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
  /** Chiavi cambiate durante il giro (update senza righe): niente stato, niente email. */
  skipped: number;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function runLinkChecks(keys: CheckableKey[], deps: LinkCheckDeps): Promise<LinkCheckSummary> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((m: string) => console.error(m));
  const s: LinkCheckSummary = { checked: 0, ok: 0, failed: 0, downgraded: 0, restored: 0, errors: 0, notifyErrors: 0, skipped: 0 };

  for (const k of keys) {
    s.checked++;
    let notice: LinkNotice | null;
    let ok: boolean;
    try {
      ok = (await deps.hasLink(k.attribution_url)) || (await deps.widgetSeen(k.domain));
      const next = nextLinkState({ status: k.status, link_failures: k.link_failures }, ok);
      const saved = await deps.update(k, {
        status: next.status,
        link_failures: next.link_failures,
        link_ok: ok,
        link_checked_at: now().toISOString(),
      });
      if (!saved) {
        s.skipped++;
        log(`[link-check] chiave ${k.id} (${k.domain}) cambiata durante la verifica: saltata`);
        continue;
      }
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

export const WIDGET_MIN_VISITORS = 2;

/**
 * Filtro PostgREST (.or) per le righe di traffic_log del dominio: apex, www e
 * sottodomini. null se il dominio ha caratteri fuori da [a-z0-9.-]: non
 * dovrebbe succedere (normalizeDomain all'inserimento), ma cosi' nel filtro
 * non finiscono mai %, _, virgole o parentesi.
 */
export function widgetHostFilter(domain: string): string | null {
  if (!/^[a-z0-9.-]+$/.test(domain)) return null;
  return `origin_host.in.(${domain},www.${domain}),origin_host.ilike.*.${domain}`;
}

/**
 * Il widget "c'e'" se lo hanno caricato almeno WIDGET_MIN_VISITORS visitatori
 * distinti (ip_hash) dal dominio: un solo curl con un Origin falso non basta a
 * tenere viva la chiave. Ricontrolla l'host perche' il filtro SQL e' largo.
 */
export function widgetSeenFromRows(
  rows: { origin_host: string | null; ip_hash: string | null }[],
  domain: string,
  min: number = WIDGET_MIN_VISITORS,
): boolean {
  const visitors = new Set<string>();
  for (const r of rows) {
    if (r.ip_hash && r.origin_host && hostMatchesDomain(r.origin_host, domain)) visitors.add(r.ip_hash);
  }
  return visitors.size >= min;
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

export interface LinkCheckMail {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}

/** Invio di un'email (Resend nello script). null = RESEND_API_KEY non configurata. */
export type LinkCheckSender = (mail: LinkCheckMail) => Promise<{ error: { message: string } | null }>;

/**
 * notify() per runLinkChecks. Ogni email non partita, anche per la chiave
 * Resend mancante, stampa un ::warning:: (visibile nel riepilogo di GitHub
 * Actions) e rilancia: finisce in notifyErrors e il workflow esce con 1.
 */
export function linkCheckNotifier(
  send: LinkCheckSender | null,
  o: { from: string; replyTo: string; warn?: (line: string) => void },
): LinkCheckDeps["notify"] {
  const warn = o.warn ?? ((line: string) => console.log(line));
  return async (k, kind) => {
    try {
      if (!send) throw new Error("RESEND_API_KEY non configurata, nessuna email inviata");
      const { subject, text } = linkCheckEmail(k, kind);
      const res = await send({ from: o.from, to: k.email, replyTo: o.replyTo, subject, text });
      if (res.error) throw new Error(res.error.message);
    } catch (e) {
      warn(`::warning::Email "${kind}" non inviata per la chiave ${k.id} (${k.domain}): ${oneLine(message(e))}`);
      throw e;
    }
  };
}
