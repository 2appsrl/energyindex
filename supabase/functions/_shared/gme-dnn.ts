/**
 * GME DotNetNuke (DNN) bootstrap helper.
 *
 * Il sito www.mercatoelettrico.org (Esiti elettricità + gas) è una webapp DNN.
 * Le pagine "Esiti" embeddano un modulo Angular che chiama una Web API DNN
 * protetta da anti-forgery: serve scrapare dalla pagina contenitore
 *   - cookie ASP.NET (Session, RequestVerificationToken)
 *   - __RequestVerificationToken (input hidden)
 *   - TabId, ModuleId  (in <script> con la window-config DNN)
 * e poi rigirarli sulle chiamate API come headers.
 *
 * I moduli scoperti:
 *   - Elettricità (PUN/zonali): /DesktopModules/GmeEsitiPrezziME/API
 *   - Gas (PSV via MGP-GAS):    /DesktopModules/GmeEsitiMGAS/API
 *
 * Questo helper non sa nulla del modulo specifico — riceve la URL di una
 * pagina contenitore qualunque, fa lo scraping, e ritorna la sessione
 * spendibile su qualunque endpoint DNN dello stesso sito.
 *
 * Runtime-agnostic: usa solo `fetch` (Node 20+ e Deno entrambi nativi).
 * Promosso da `spikes/lib/gme-dnn.ts` in Slice 1 Task 5 — riusato dall'Edge
 * Function di ingestion (Deno) e dagli spike di sviluppo (Node + tsx).
 *
 * @see spikes/gme-pun.ts
 * @see spikes/gme-psv.ts
 */
export const GME_BASE = "https://www.mercatoelettrico.org";

export const GME_USER_AGENT =
  "EnergyIndex-Spike/0.1 (research; contact: commerciale@deagroup.biz)";

export interface GmeDnnSession {
  /** URL della pagina contenitore da cui è stata estratta la sessione (per Referer). */
  pageUrl: string;
  /** Cookie header pronto da rinviare (Cookie: ...). */
  cookieHeader: string;
  /** Valore di `__RequestVerificationToken` (anti-forgery). */
  verificationToken: string;
  /** ModuleId DNN del modulo Angular sulla pagina (usato come header). */
  moduleId: string;
  /** TabId DNN della pagina (usato come header). */
  tabId: string;
  /** HTTP status del fetch della pagina (utile per i report dello spike). */
  pageStatus: number;
  /** Bytes HTML scaricati (utile per i report dello spike). */
  pageBytes: number;
}

/**
 * Visita la pagina contenitore DNN e ne estrae i 3 token + cookie.
 *
 * @param pageUrl URL completa della pagina (es. `${GME_BASE}/it-it/Home/Esiti/...`).
 * @throws se la pagina non risponde 200 o se mancano token/ID nel markup.
 */
export async function bootstrapGmeDnnSession(
  pageUrl: string,
): Promise<GmeDnnSession> {
  const res = await fetch(pageUrl, {
    headers: { "User-Agent": GME_USER_AGENT, Accept: "text/html" },
    redirect: "follow",
  });
  const html = await res.text();

  if (res.status !== 200) {
    throw new Error(
      `[bootstrapGmeDnnSession] HTTP ${res.status} su ${pageUrl} ` +
        `(bytes=${html.length}). Pagina contenitore non raggiungibile.`,
    );
  }

  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookieHeader = setCookies
    .map((c) => c.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");

  const rvtMatch = html.match(
    /name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/,
  );
  const moduleIdMatch = html.match(/"ModuleId":(\d+)/);
  const tabIdMatch = html.match(/"TabId":(\d+)/);

  if (!rvtMatch || !moduleIdMatch || !tabIdMatch) {
    throw new Error(
      `[bootstrapGmeDnnSession] estrazione token DNN fallita su ${pageUrl} ` +
        `(rvt=${!!rvtMatch} moduleId=${!!moduleIdMatch} tabId=${!!tabIdMatch}). ` +
        `Forse la pagina ha cambiato struttura.`,
    );
  }

  return {
    pageUrl,
    cookieHeader,
    verificationToken: rvtMatch[1],
    moduleId: moduleIdMatch[1],
    tabId: tabIdMatch[1],
    pageStatus: res.status,
    pageBytes: html.length,
  };
}

/**
 * Headers da attaccare a una `fetch` verso la Web API DNN
 * usando la sessione ottenuta da `bootstrapGmeDnnSession`.
 */
export function gmeApiHeaders(session: GmeDnnSession): Record<string, string> {
  return {
    "User-Agent": GME_USER_AGENT,
    Accept: "application/json, text/plain, */*",
    Cookie: session.cookieHeader,
    RequestVerificationToken: session.verificationToken,
    ModuleId: session.moduleId,
    TabId: session.tabId,
    userid: "-1",
    Referer: session.pageUrl,
  };
}

/**
 * Helper di convenienza: GET su un endpoint DNN con i headers giusti.
 * Restituisce status + body raw — il chiamante decide come parsare.
 */
export async function gmeApiGet(
  session: GmeDnnSession,
  apiPath: string,
  query: Record<string, string>,
): Promise<{ status: number; body: string; url: string }> {
  const url = new URL(GME_BASE + apiPath);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: gmeApiHeaders(session) });
  return { status: res.status, body: await res.text(), url: url.toString() };
}
