import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Info, TriangleAlert } from "lucide-react";
import {
  API_BASE_URL,
  API_CONTACT_EMAIL,
  API_DOCS_URL,
  CATEGORIES,
  OPENAPI_URL,
  SNIPPET_LABELS,
  buildSnippet,
  endpointsByCategory,
  tierById,
  type ApiEndpoint,
  type SnippetLang,
  type TierId,
} from "@/lib/api/catalog";
import { MethodBadge, StatusBadge, TierBadge, TIER_STYLE } from "@/components/api/badges";
import { CodeBlock, CodeTabs } from "@/components/api/code";
import { buildSnippet as buildWidgetSnippet } from "@/lib/widget/snippet";
import { breadcrumbList, jsonLdString, techArticle } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils";

const TITLE = "Documentazione API Energy Index — riferimento tecnico v1";
const DESCRIPTION =
  "Riferimento completo delle API Energy Index v1: autenticazione, limiti, errori, formati, widget e schema di ogni endpoint per PUN, PSV, zone, Energy Index e forecast.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: API_DOCS_URL },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "article", locale: "it_IT", url: "/it/api/docs" },
  twitter: { card: "summary_large_image" },
};

const GUIDE_SECTIONS = [
  { id: "introduzione", title: "Introduzione" },
  { id: "avvio-rapido", title: "Avvio rapido" },
  { id: "autenticazione", title: "Autenticazione" },
  { id: "versioni", title: "Base URL e versioni" },
  { id: "formati", title: "Formati, unita' e date" },
  { id: "limiti", title: "Limiti di utilizzo" },
  { id: "errori", title: "Errori" },
  { id: "cache", title: "Cache e CORS" },
  { id: "webhook", title: "Webhook" },
  { id: "widget", title: "Widget" },
  { id: "licenza", title: "Attribuzione e licenza" },
  { id: "changelog", title: "Changelog" },
] as const;

const LANGS: SnippetLang[] = ["curl", "javascript", "python", "sheets"];

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            techArticle({
              headline: TITLE,
              description: DESCRIPTION,
              url: API_DOCS_URL,
              author: "Energy Index",
              datePublished: "2026-06-28",
              dateModified: "2026-10-31",
              keywords: ["API PUN", "API PSV", "API prezzi energia", "PUN JSON", "GME API", "OpenAPI"],
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbList([
              { name: "Energy Index", url: "https://energyindex.it/it" },
              { name: "API", url: "https://energyindex.it/it/api" },
              { name: "Documentazione", url: API_DOCS_URL },
            ]),
          ),
        }}
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* ------------------------------------------------ SIDEBAR */}
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:pb-10">
          <Link href="/it/api" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline dark:text-violet-400">
            <ArrowLeft className="size-4" /> Panoramica API
          </Link>
          {/* Su mobile l'indice e' comprimibile, altrimenti occupa tutto il primo schermo. */}
          <details className="rounded-xl border bg-card p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-bold">Indice della documentazione</summary>
            <div className="mt-4">
              <DocsNav />
            </div>
          </details>
          <div className="hidden lg:block">
            <DocsNav />
          </div>
        </aside>

        {/* ------------------------------------------------ CONTENT */}
        <article className="min-w-0 space-y-16">
          <header className="space-y-4 border-b pb-8">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-500/30 dark:text-violet-300">
                Riferimento tecnico
              </span>
              <span className="rounded-full bg-muted px-3 py-1 font-mono text-xs font-semibold ring-1 ring-border">v1</span>
              <a href={OPENAPI_URL} className="rounded-full bg-muted px-3 py-1 font-mono text-xs font-semibold ring-1 ring-border hover:bg-muted/70">
                openapi.json ↗
              </a>
            </div>
            <h1 className="text-4xl font-black tracking-tight">Documentazione API</h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Tutto quello che serve per integrare i dati di Energy Index: autenticazione, limiti, formati, codici di
              errore e il contratto di ogni endpoint.
            </p>
          </header>

          <DocSection id="introduzione" title="Introduzione">
            <p>
              L&apos;API Energy Index e&apos; un&apos;API REST in sola lettura (salvo gli alert) che espone i prezzi
              all&apos;ingrosso dell&apos;energia in Italia e gli indici derivati calcolati da Energy Index. Tutte le
              risposte sono JSON in UTF-8; alcuni endpoint supportano anche CSV.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["open", "developer", "api"] as TierId[]).map((id) => {
                const t = tierById(id);
                return (
                  <div key={id} className="rounded-xl border bg-card p-4">
                    <TierBadge tier={id} />
                    <p className="mt-2 text-sm font-semibold">{t.auth}</p>
                    <p className="text-xs text-muted-foreground">{t.quota} · {t.rateLimit}</p>
                  </div>
                );
              })}
            </div>
            <Callout kind="info">
              Gli endpoint contrassegnati <StatusBadge status="coming" className="mx-1 align-middle" /> hanno il
              contratto pubblicato in anteprima ma non rispondono ancora. Path e campi possono cambiare prima del
              rilascio; gli endpoint <StatusBadge status="live" className="mx-1 align-middle" /> sono stabili.
            </Callout>
          </DocSection>

          <DocSection id="avvio-rapido" title="Avvio rapido">
            <p>La prima chiamata non richiede registrazione:</p>
            <CodeBlock code={`curl ${API_BASE_URL}/pun/today`} title="terminale" />
            <p>Con una chiave (piani Developer e superiori), passala nell&apos;header <Code>Authorization</Code>:</p>
            <CodeBlock
              code={`export EIDX_API_KEY="eidx_live_••••••••"\n\ncurl "${API_BASE_URL}/energy-index?commodity=luce" \\\n  -H "Authorization: Bearer $EIDX_API_KEY"`}
              title="terminale"
            />
          </DocSection>

          <DocSection id="autenticazione" title="Autenticazione">
            <p>
              Gli endpoint attivi oggi sono tutti del piano Open e rispondono anche senza chiave. La chiave alza il
              limite di richieste al minuto e servira&apos; per gli endpoint dei piani superiori. Ha il formato{" "}
              <Code>eidx_live_</Code> seguito da 32 caratteri e va inviata in ogni richiesta:
            </p>
            <Table
              head={["Metodo", "Esempio", "Quando usarlo"]}
              rows={[
                [<Code key="a">Authorization</Code>, <Code key="b">Bearer eidx_live_…</Code>, "Sempre: e' il metodo consigliato."],
                [<Code key="c">?key=</Code>, <Code key="d">…/pun/today?key=eidx_live_…</Code>, "Sconsigliato. Resta accettato per gli strumenti che non permettono header, ma crea una copia separata in cache per ogni chiave e la chiave resta visibile nell'URL."],
              ]}
            />
            <p>
              Un token <Code>Bearer</Code> che non inizia con <Code>eidx_live_</Code> viene ignorato e la richiesta
              vale come anonima, con i limiti del piano Open.
            </p>
            <p>
              La chiave Developer e&apos; legata al dominio che indichi nella richiesta. Le chiamate dal browser con la
              chiave devono arrivare da quel dominio o da un suo sottodominio (header <Code>Origin</Code>);{" "}
              <Code>localhost</Code> e <Code>127.0.0.1</Code> sono ammessi per lo sviluppo. Un{" "}
              <Code>Origin: null</Code> (iframe sandbox, file locali) con la chiave viene respinto. Le chiamate dal
              tuo server, senza <Code>Origin</Code>, sono sempre ammesse.
            </p>
            <Table
              head={["HTTP", "error", "Quando"]}
              rows={[
                ["401", "invalid_key", "Chiave sconosciuta o revocata, oppure non ancora attivata dal link ricevuto via email (il messaggio lo indica)."],
                ["403", "origin_not_allowed", "Chiamata dal browser con un Origin diverso dal dominio della chiave."],
              ].map(([a, b, c]) => [<Code key="h">{a}</Code>, <Code key="e">{b}</Code>, c])}
            />
            <Callout kind="warn">
              Nel JavaScript di una pagina pubblica la chiave e&apos; leggibile da chiunque: il vincolo sul dominio ne
              limita l&apos;uso dai browser, non dai server. Per mostrare dati in un sito bastano gli endpoint Open
              senza chiave, oppure il <a href="#widget" className="underline">widget</a>. Se una chiave e&apos; stata
              esposta, scrivi a <a className="underline" href={`mailto:${API_CONTACT_EMAIL}`}>{API_CONTACT_EMAIL}</a> e
              la revochiamo: l&apos;API la rifiuta entro circa un minuto.
            </Callout>
            <p>
              Quando saranno attivi, gli endpoint dei piani superiori risponderanno <Code>403 tier_required</Code> a
              una chiave di piano inferiore, con il piano necessario nel campo <Code>required_tier</Code>.
            </p>
          </DocSection>

          <DocSection id="versioni" title="Base URL e versioni">
            <CodeBlock code={API_BASE_URL} title="base URL" />
            <ul className="list-disc space-y-1.5 pl-5">
              <li>La versione e&apos; nel path. Dentro <Code>/v1</Code> aggiungiamo solo campi e endpoint nuovi, mai modifiche incompatibili.</li>
              <li>Il tuo codice deve ignorare i campi che non conosce.</li>
              <li>
                Un endpoint deprecato continua a funzionare per almeno 12 mesi e risponde con gli header{" "}
                <Code>Deprecation</Code> e <Code>Sunset</Code> (RFC 8594).
              </li>
              <li>
                Solo HTTPS. Le richieste a <Code>energyindex.pro</Code> e <Code>www.</Code> vengono reindirizzate al
                dominio canonico: usa sempre <Code>energyindex.it</Code> per evitare il redirect.
              </li>
            </ul>
          </DocSection>

          <DocSection id="formati" title="Formati, unita' e date">
            <Table
              head={["Aspetto", "Convenzione"]}
              rows={[
                ["Formato", "JSON UTF-8. Con format=csv: separatore ';', decimali con la virgola, intestazione nella prima riga."],
                ["Prezzi energia e gas", "value in €/kWh (5 decimali) per la lettura in bolletta, value_native in €/MWh come pubblicato da GME."],
                ["Brent e CO2", "$/bbl e €/tCO2, solo nel campo value."],
                ["Giorni di mercato", "YYYY-MM-DD nel fuso Europe/Rome. Per il PSV date e' il giorno gas di consegna; la sessione di negoziazione e' in session_date."],
                ["Timestamp", "ISO 8601. observed_at in UTC (Z); gli orari del PUN orario con offset Europe/Rome (+01:00 / +02:00)."],
                ["Cambio ora", "Nei giorni di passaggio ora legale/solare il PUN orario ha 23 o 25 ore."],
                ["Numeri", "Numeri JSON, mai stringhe. Nessun valore mancante e' restituito come 0."],
              ]}
            />
          </DocSection>

          <DocSection id="limiti" title="Limiti di utilizzo">
            <Table
              head={["Piano", "Richieste/minuto", "Richieste/mese", "Storico"]}
              rows={(["open", "developer", "api", "pro", "trading", "enterprise"] as TierId[]).map((id) => {
                const t = tierById(id);
                return [<TierBadge key={id} tier={id} />, t.rateLimit, t.quota, t.history];
              })}
            />
            <p>
              Senza chiave il limite vale per indirizzo IP; con una chiave attiva vale per chiave. Oggi si applica in
              automatico il limite al minuto: la quota mensile e&apos; il riferimento d&apos;uso del piano e non
              blocca le richieste.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Le chiamate si contano su finestre di 5 minuti, comprese quelle servite dalla cache e quelle respinte.
                Chi supera 5 volte il limite al minuto in una finestra riceve per 15 minuti{" "}
                <Code>429 rate_limited</Code> con <Code>Retry-After: 900</Code>.
              </li>
              <li>
                Il conteggio e&apos; asincrono e il blocco scatta entro qualche minuto: il limite e&apos; morbido,
                quindi qualche richiesta oltre la soglia puo&apos; passare. Non contare su questo margine.
              </li>
              <li>
                Attivazioni, revoche e declassamenti delle chiavi sono riconosciuti entro circa un minuto.
              </li>
            </ul>
            <p>Header di risposta:</p>
            <CodeBlock code={`X-RateLimit-Limit: 120\nX-EIDX-Key-Status: active`} title="header di risposta" />
            <Table
              head={["Header", "Contenuto"]}
              rows={[
                ["X-RateLimit-Limit", "Limite al minuto applicato alla richiesta: quello del piano con una chiave attiva, 60 altrimenti."],
                ["X-EIDX-Key-Status", "Solo con chiave: active, oppure downgraded se la chiave e' stata declassata."],
                ["X-EIDX-Notice", "attribution-missing quando la chiave e' declassata perche' manca il link di attribuzione (vedi Licenza)."],
                ["Retry-After", "Solo sulle risposte 429: secondi da attendere."],
              ].map(([a, b]) => [<Code key="h">{a}</Code>, b])}
            />
            <p>
              Non c&apos;e&apos; un header con le richieste rimanenti, perche&apos; il conteggio non e&apos; in tempo
              reale. Dopo un 429 riprova dopo il tempo indicato, con un backoff esponenziale. I dati cambiano al
              massimo qualche volta al giorno: interrogare lo stesso endpoint piu&apos; di una volta ogni 15 minuti
              non porta valori nuovi.
            </p>
          </DocSection>

          <DocSection id="errori" title="Errori">
            <p>Gli errori usano i codici HTTP standard e un corpo JSON sempre uguale:</p>
            <CodeBlock
              json
              code={JSON.stringify(
                {
                  error: "tier_required",
                  message: "Questo endpoint richiede il piano API o superiore.",
                  required_tier: "api",
                  docs: `${API_DOCS_URL}#limiti`,
                },
                null,
                2,
              )}
              title="403 Forbidden"
            />
            <Table
              head={["HTTP", "error", "Significato"]}
              rows={[
                ["400", "invalid_parameter", "Parametro mancante o non valido. Il campo param indica quale."],
                ["401", "invalid_key", "Chiave sconosciuta, revocata o non ancora attivata."],
                ["403", "origin_not_allowed", "Chiamata dal browser da un dominio diverso da quello della chiave."],
                ["403", "tier_required", "Endpoint dei piani superiori, quando saranno attivi: l'endpoint non e' incluso nel tuo piano."],
                ["404", "not_found", "Endpoint o risorsa inesistente."],
                ["429", "rate_limited", "Limite di richieste superato: attendi i secondi indicati in Retry-After."],
                ["500", "internal_error", "Errore nostro. Riprova; se persiste, scrivici indicando URL e ora della richiesta."],
                ["503", "no_data", "La fonte non ha ancora pubblicato il dato (es. PUN richiesto prima dell'esito del MGP)."],
              ].map(([a, b, c]) => [<Code key="h">{a}</Code>, <Code key="e">{b}</Code>, c])}
            />
          </DocSection>

          <DocSection id="cache" title="Cache e CORS">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Le risposte sono servite da CDN con <Code>Cache-Control: public, max-age=900, stale-while-revalidate=3600</Code>:
                un nuovo valore compare al massimo 15 minuti dopo la pubblicazione della fonte.
              </li>
              <li>
                Gli endpoint hanno <Code>Access-Control-Allow-Origin: *</Code> e rispondono a <Code>OPTIONS</Code>:
                si possono chiamare direttamente da JavaScript nel browser. Header ammessi:{" "}
                <Code>Content-Type</Code> e <Code>Authorization</Code>. Header leggibili dal tuo script:{" "}
                <Code>X-RateLimit-Limit</Code>, <Code>X-EIDX-Key-Status</Code>, <Code>X-EIDX-Notice</Code> e{" "}
                <Code>Retry-After</Code>.
              </li>
              <li>
                Dal browser la chiave funziona solo dal suo dominio (vedi{" "}
                <a href="#autenticazione" className="underline">Autenticazione</a>). Per i piani a pagamento chiama
                l&apos;API dal tuo server.
              </li>
            </ul>
          </DocSection>

          <DocSection id="webhook" title="Webhook">
            <p>
              Con <a href="#alerts-create" className="font-semibold text-violet-700 underline dark:text-violet-400">POST /alerts</a>{" "}
              registri una soglia; quando l&apos;indice la attraversa, inviamo una <Code>POST</Code> al tuo URL:
            </p>
            <CodeBlock
              json
              title="payload inviato al tuo webhook_url"
              code={JSON.stringify(
                {
                  type: "alert.triggered",
                  alert_id: "alr_8Kq2mZ",
                  asset: "PSV",
                  condition: "above",
                  threshold: 45,
                  value: 46.2,
                  unit: "€/MWh",
                  date: "2026-09-26",
                  triggered_at: "2026-09-26T16:04:11Z",
                },
                null,
                2,
              )}
            />
            <p>
              Ogni chiamata ha l&apos;header <Code>X-EIDX-Signature</Code>: HMAC-SHA256 del corpo grezzo con il{" "}
              <Code>signing_secret</Code> dell&apos;alert. Verificalo prima di fidarti del contenuto:
            </p>
            <CodeBlock
              title="verifica.js"
              code={`import crypto from "node:crypto";\n\nexport function isValid(rawBody, signature, secret) {\n  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");\n  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));\n}`}
            />
            <p>
              Rispondi con un 2xx entro 10 secondi. In caso di errore ritentiamo 5 volte in 24 ore con backoff
              esponenziale; dopo 20 fallimenti consecutivi l&apos;alert viene sospeso e ti avvisiamo via email.
            </p>
          </DocSection>

          <DocSection id="widget" title="Widget">
            <p>
              Per mostrare i dati in un sito senza programmare c&apos;e&apos; il widget: nel{" "}
              <Link href="/it/api/widget" className="font-semibold text-violet-700 underline dark:text-violet-400">
                configuratore
              </Link>{" "}
              scegli variante e tema, poi incolli lo snippet nella pagina. Non serve una chiave.
            </p>
            <CodeBlock code={buildWidgetSnippet("indice-luce", "light")} title="index.html" />
            <Table
              head={["Variante", "Dati", "Endpoint"]}
              rows={[
                [<span key="v" className="whitespace-nowrap"><Code>indice-luce</Code></span>, "Energy Index delle offerte luce, fisse e variabili", <Code key="e">/energy-index?commodity=luce</Code>],
                [<span key="v" className="whitespace-nowrap"><Code>indice-gas</Code></span>, "Energy Index delle offerte gas, fisse e variabili", <Code key="e">/energy-index?commodity=gas</Code>],
                [<Code key="v">pun</Code>, "PUN, media del giorno (GME)", <Code key="e">/pun/today</Code>],
                [<Code key="v">psv</Code>, "PSV del giorno gas (GME)", <Code key="e">/psv/today</Code>],
              ]}
            />
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Lo snippet contiene gia&apos; nell&apos;HTML il link a Energy Index nella riga &quot;Fonte&quot;. Puoi
                cambiarne lo stile, ma deve restare visibile: se il link manca o e&apos; nascosto, il widget si
                disattiva e non mostra i dati.
              </li>
              <li>
                Nelle varianti <Code>pun</Code> e <Code>psv</Code> la riga e&apos; &quot;Fonte: Gestore dei Mercati
                Energetici S.p.A. — via Energy Index&quot; e non va rimossa. Le condizioni del GME restano valide anche
                nel widget (vedi <a href="#licenza" className="underline">Attribuzione e licenza</a>).
              </li>
            </ul>
          </DocSection>

          <DocSection id="licenza" title="Attribuzione e licenza">
            <p>
              Le API restituiscono due tipi di dati, con regole diverse. Ogni risposta contiene il testo di
              attribuzione pronto nel campo <Code>attribution</Code>.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Elaborazioni Energy Index</strong>{" "}(Energy Index delle offerte e statistiche calcolate da noi):
                nei piani Open e Developer sono utilizzabili gratuitamente, anche a fini commerciali, mostrando accanto
                al dato &quot;Fonte: Energy Index&quot; con un link a energyindex.it. I forecast hanno una{" "}
                <Link href="/it/forecast/metodologia#licenza" className="underline">licenza dedicata</Link>.
              </li>
              <li>
                <strong>Dati delle fonti</strong>{" "}(PUN, prezzi zonali e PSV dal GME; TTF, Brent e CO2 da ICE Endex,
                EIA ed EEX): Energy Index li riporta a scopo informativo e non concede licenze su di essi. Il riuso
                resta soggetto alle condizioni di ciascuna fonte. Per i dati GME le{" "}
                <a href="https://www.mercatoelettrico.org/en-us/Home/TermsOfUse" target="_blank" rel="noopener" className="underline">
                  condizioni di utilizzo
                </a>{" "}
                richiedono un&apos;autorizzazione scritta del GME per gli usi commerciali e la citazione &quot;Fonte:
                Gestore dei Mercati Energetici S.p.A.&quot;, gia&apos; inclusa nel campo <Code>attribution</Code>{" "}
                (il link alle condizioni e&apos; in <Code>source_terms_url</Code>).
              </li>
            </ul>
            <CodeTabs
              tabs={[
                { id: "html", label: "HTML", code: `<p>Fonte: <a href="https://energyindex.it" target="_blank" rel="noopener">Energy Index</a></p>` },
                { id: "md", label: "Markdown", code: "Fonte: [Energy Index](https://energyindex.it)" },
                { id: "txt", label: "Testo", code: "Fonte: Energy Index (https://energyindex.it)" },
              ]}
            />
            <h3 className="pt-2 text-lg font-bold">Verifica del link per le chiavi Developer</h3>
            <p>
              Quando chiedi una chiave Developer indichi la pagina in cui mostri i dati. Ogni lunedi&apos;
              controlliamo che quella pagina contenga un link a energyindex.it. Vale qualsiasi <Code>rel</Code>,
              anche <Code>nofollow</Code> o <Code>sponsored</Code>: chiediamo un link visibile, non un link che
              trasmetta ranking.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Dopo 2 verifiche fallite di seguito la chiave viene declassata ai limiti del piano Open e ti avvisiamo
                via email. Le risposte portano <Code>X-EIDX-Key-Status: downgraded</Code> e{" "}
                <Code>X-EIDX-Notice: attribution-missing</Code>.
              </li>
              <li>Quando il link torna, la prima verifica successiva riattiva la chiave in automatico.</li>
              <li>
                Se la pagina mostra il link solo via JavaScript, la verifica non lo vede nell&apos;HTML. In quel caso
                conta anche il widget: se negli ultimi 7 giorni e&apos; stato caricato dal tuo dominio da almeno 2
                visitatori distinti, la verifica e&apos; superata.
              </li>
            </ul>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Dal piano API l&apos;attribuzione a Energy Index e&apos; facoltativa ed Enterprise include l&apos;uso
                white-label; restano le citazioni richieste dalle fonti.
              </li>
              <li>Non e&apos; consentito rivendere l&apos;API tale e quale come servizio concorrente.</li>
              <li>I forecast sono stime statistiche, non consulenza finanziaria o raccomandazioni di investimento.</li>
            </ul>
          </DocSection>

          <DocSection id="changelog" title="Changelog">
            <ol className="space-y-3 border-l-2 pl-5">
              <li>
                <span className="font-mono text-xs text-muted-foreground">2026-10-31</span>
                <p>
                  <Code>/energy-index</Code> attivo. Chiavi Developer self-service, legate al dominio, con verifica
                  settimanale del link di attribuzione. Limiti al minuto applicati (<Code>429</Code> con{" "}
                  <Code>Retry-After</Code>), nuovi header <Code>X-EIDX-Key-Status</Code> e{" "}
                  <Code>X-EIDX-Notice</Code>, errori <Code>invalid_key</Code> e <Code>origin_not_allowed</Code>.
                  Widget embeddabile con configuratore. Tolti dagli esempi gli header <Code>X-RateLimit-Remaining</Code>,{" "}
                  <Code>X-RateLimit-Reset</Code> e <Code>X-Quota-Remaining</Code>, che l&apos;API non ha mai inviato.
                </p>
              </li>
              <li>
                <span className="font-mono text-xs text-muted-foreground">2026-10-30</span>
                <p>
                  <Code>/pun/today</Code>: nuovi campi <Code>daily_average</Code> (media del giorno, PUN Index GME),{" "}
                  <Code>hour</Code> e <Code>granularity</Code>. <Code>/psv/today</Code>: <Code>date</Code> ora indica
                  il giorno gas di consegna (prima era la data UTC, un giorno indietro); nuovi campi{" "}
                  <Code>gas_day</Code>, <Code>session_date</Code> e <Code>product</Code>. Sui dati GME,{" "}
                  <Code>attribution</Code> cita la fonte e <Code>source_terms_url</Code> rimanda alle condizioni
                  d&apos;uso. Licenza riscritta per distinguere le elaborazioni Energy Index dai dati delle fonti.
                </p>
              </li>
              <li>
                <span className="font-mono text-xs text-muted-foreground">2026-09-27</span>
                <p>Pubblicati documentazione, piani e contratti in anteprima di tutti gli endpoint. Spec OpenAPI 3.1.</p>
              </li>
              <li>
                <span className="font-mono text-xs text-muted-foreground">2026-06-28</span>
                <p>Lancio v1: <Code>/pun/today</Code>, <Code>/psv/today</Code>, <Code>/today</Code>.</p>
              </li>
            </ol>
          </DocSection>

          {/* ------------------------------------------------ ENDPOINTS */}
          {CATEGORIES.map((cat) => (
            <section key={cat.id} className="space-y-10">
              <div className="border-b pb-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">Endpoint</p>
                <h2 className="text-3xl font-black tracking-tight">{cat.name}</h2>
                <p className="text-muted-foreground">{cat.description}</p>
              </div>
              {endpointsByCategory(cat.id).map((e) => (
                <EndpointDoc key={e.id} e={e} />
              ))}
            </section>
          ))}

          <div className="rounded-2xl border bg-muted/40 p-6 text-sm">
            Manca qualcosa? Scrivi a{" "}
            <a href={`mailto:${API_CONTACT_EMAIL}`} className="font-semibold underline">{API_CONTACT_EMAIL}</a>{" "}
            oppure <Link href="/it/api#chiave" className="font-semibold underline">richiedi una chiave</Link>.
          </div>
        </article>
      </div>
    </div>
  );
}

function DocsNav() {
  return (
    <nav aria-label="Indice documentazione" className="space-y-6 text-sm">
      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Guida</p>
        <ul className="space-y-1">
          {GUIDE_SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
      {CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{cat.name}</p>
          <ul className="space-y-1">
            {endpointsByCategory(cat.id).map((e) => (
              <li key={e.id}>
                <a href={`#${e.id}`} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted">
                  <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TIER_STYLE[e.tier].dot)} />
                  <span className="truncate font-mono text-xs">{e.path}</span>
                  {e.status === "live" && <span className="ml-auto text-[9px] font-black text-emerald-600">LIVE</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function EndpointDoc({ e }: { e: ApiEndpoint }) {
  const tabs = LANGS.filter((l) => l !== "sheets" || e.method === "GET").map((l) => ({
    id: l,
    label: SNIPPET_LABELS[l],
    code: buildSnippet(e, l),
  }));
  return (
    <section id={e.id} className="scroll-mt-6 space-y-5 rounded-3xl border bg-card p-6 sm:p-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={e.method} className="text-xs" />
          <code className="break-all font-mono text-lg font-bold">{e.path}</code>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={e.status} />
          <TierBadge tier={e.tier} />
          {e.formats.map((f) => (
            <span key={f} className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase ring-1 ring-border">
              {f}
            </span>
          ))}
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
            Cache: {e.cache}
          </span>
        </div>
        <h3 className="text-2xl font-bold">{e.title}</h3>
        <p className="text-muted-foreground">{e.description}</p>
      </div>

      {e.tierLimits && (
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(e.tierLimits).map(([tier, limit]) => (
            <div key={tier} className="rounded-xl border p-3">
              <TierBadge tier={tier as TierId} />
              <p className="mt-1.5 text-sm font-medium">{limit}</p>
            </div>
          ))}
        </div>
      )}

      {e.params.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Parametri</h4>
          <Table
            head={["Nome", "In", "Tipo", "Descrizione"]}
            rows={e.params.map((p) => [
              <span key="n" className="whitespace-nowrap">
                <Code>{p.name}</Code>
                {p.required && <span className="ml-1 text-[10px] font-bold uppercase text-rose-600">obbl.</span>}
              </span>,
              p.in,
              <span key="t" className="font-mono text-xs">{p.type}</span>,
              <span key="d">
                {p.description}
                {p.enum && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {p.enum.map((v) => (
                      <Code key={v}>{v}</Code>
                    ))}
                  </span>
                )}
                {p.default !== undefined && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Default: <Code>{String(p.default)}</Code>
                  </span>
                )}
              </span>,
            ])}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Richiesta</h4>
          <CodeTabs tabs={tabs} />
        </div>
        <div className="min-w-0 space-y-2">
          <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Risposta 200</h4>
          <CodeBlock json code={JSON.stringify(e.response, null, 2)} title="application/json" maxHeight="26rem" />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Campi della risposta</h4>
        <Table
          head={["Campo", "Tipo", "Descrizione"]}
          rows={e.fields.map((f) => [<Code key="n">{f.name}</Code>, <span key="t" className="font-mono text-xs">{f.type}</span>, f.description])}
        />
      </div>
    </section>
  );
}

function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4 text-[15px] leading-relaxed">
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {head.map((h) => (
              <th key={h} className="p-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t align-top">
              {r.map((c, j) => (
                <td key={j} className="p-3">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ kind, children }: { kind: "info" | "warn"; children: ReactNode }) {
  const Icon = kind === "info" ? Info : TriangleAlert;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-4 text-sm",
        kind === "info" ? "border-sky-500/30 bg-sky-500/5" : "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", kind === "info" ? "text-sky-600" : "text-amber-600")} />
      <div>{children}</div>
    </div>
  );
}
