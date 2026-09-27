import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Braces,
  Check,
  Code2,
  FileJson,
  FileSpreadsheet,
  Globe2,
  KeyRound,
  Link2,
  Minus,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { fetchLatestPrice } from "@/lib/api/latest-price";
import {
  API_BASE_URL,
  API_LANDING_URL,
  CATEGORIES,
  ENDPOINTS,
  ANNUAL_DISCOUNT_PCT,
  OPENAPI_URL,
  TIERS,
  buildSnippet,
  endpointsByCategory,
  formatTierPrice,
  tierById,
  type TierId,
} from "@/lib/api/catalog";
import { MethodBadge, StatusBadge, TierBadge, TIER_STYLE } from "@/components/api/badges";
import { CodeBlock, CodeTabs } from "@/components/api/code";
import { TryIt } from "@/components/api/TryIt";
import { UseCases } from "@/components/api/UseCases";
import { ApiKeyRequestForm } from "@/components/api/ApiKeyRequestForm";
import { breadcrumbList, faqPage, jsonLdString, organization } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils";

const TITLE = "API Energy Index — prezzi PUN, PSV e forecast in JSON";
const DESCRIPTION =
  "API REST per PUN, PSV, TTF, Brent e CO2, PUN orario per zona, Energy Index delle offerte ARERA e forecast. Endpoint gratuiti senza registrazione, piano API a 99 €/mese.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: API_LANDING_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "it_IT",
    url: "/it/api",
  },
  twitter: { card: "summary_large_image" },
};

const FAQ = [
  {
    question: "Le API di Energy Index sono gratuite?",
    answer:
      "Si'. Gli endpoint Open (PUN, PSV e snapshot di tutti gli indici) funzionano senza registrazione e senza chiave, anche per uso commerciale, con l'unico obbligo di citare Energy Index con un link. Il piano Developer e' gratuito con chiave e da' accesso a storico, zone e CSV. Il piano API costa 99 € al mese.",
  },
  {
    question: "Da dove vengono i dati?",
    answer:
      "PUN, prezzi zonali e PSV vengono dal GME (Gestore dei Mercati Energetici); gli Energy Index delle offerte dal Portale Offerte ARERA; TTF, Brent e CO2 da ICE Endex, EIA ed EEX. Ogni risposta indica la fonte nei campi source e source_url.",
  },
  {
    question: "Ogni quanto si aggiornano i dati?",
    answer:
      "Il PUN si aggiorna ogni giorno dopo la chiusura del Mercato del Giorno Prima, di norma entro il primo pomeriggio; il PSV a fine giornata. Le risposte sono in cache per 15 minuti, quindi un nuovo valore compare al massimo 15 minuti dopo la pubblicazione.",
  },
  {
    question: "Come devo citare Energy Index?",
    answer:
      "Accanto al dato basta la dicitura 'Fonte: Energy Index' con un link a https://energyindex.it. Ogni risposta include il testo pronto nel campo attribution. Dal piano API in su l'attribuzione e' facoltativa.",
  },
  {
    question: "Posso usare le API dentro un agente AI o un chatbot?",
    answer:
      "Si'. La specifica OpenAPI 3.1 su /api/v1/openapi.json si importa direttamente come tool nei principali framework per agenti, e /llms.txt descrive il sito ai modelli linguistici.",
  },
  {
    question: "Cosa significa 'in arrivo' su un endpoint?",
    answer:
      "Che il contratto (path, parametri e schema) e' pubblicato in anteprima ma l'endpoint non risponde ancora. Puoi richiedere la chiave ora: ti avvisiamo appena l'endpoint e' disponibile.",
  },
];

const fmt = (v: number, d = 2) =>
  v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

// Matrice di confronto piani: [etichetta, piano minimo che la include]
// oppure [etichetta, valori per piano].
const MATRIX_TIERS: TierId[] = ["open", "developer", "api", "pro", "trading", "enterprise"];
const MATRIX: { label: string; min?: TierId; values?: Partial<Record<TierId, string>> }[] = [
  { label: "Prezzi di oggi (PUN, PSV, TTF, Brent, CO2)", min: "open" },
  { label: "Energy Index delle offerte ARERA", min: "open" },
  { label: "Stima spesa bolletta e widget", min: "open" },
  {
    label: "Storico giornaliero",
    values: { open: "30 giorni", developer: "2 anni", api: "Completo", pro: "Completo", trading: "Completo", enterprise: "Completo + bulk" },
  },
  { label: "PUN per zona (giornaliero)", min: "developer" },
  { label: "Export CSV", min: "developer" },
  { label: "Forecast del giorno dopo", min: "developer" },
  { label: "PUN orario per zona", min: "api" },
  { label: "Forecast 7–180 giorni con bande", min: "api" },
  { label: "Statistiche mercato libero e spread", min: "api" },
  { label: "Alert via webhook", min: "api" },
  { label: "Forecast 12 mesi a scenari", min: "pro" },
  { label: "Margin Simulator via API", min: "pro" },
  { label: "Trading Vitals, correlazioni, backtest", min: "trading" },
  { label: "Export bulk, white-label, SLA", min: "enterprise" },
  {
    label: "Richieste al mese",
    values: { open: "Uso ragionevole", developer: "10.000", api: "100.000", pro: "500.000", trading: "2 milioni", enterprise: "Su misura" },
  },
  {
    label: "Attribuzione",
    values: { open: "Obbligatoria", developer: "Obbligatoria", api: "Facoltativa", pro: "Facoltativa", trading: "Facoltativa", enterprise: "No" },
  },
];

const RANK: Record<TierId, number> = { open: 0, developer: 1, api: 2, pro: 3, trading: 4, enterprise: 5 };

export default async function ApiLandingPage() {
  const [pun, psv] = await Promise.all([fetchLatestPrice("pun"), fetchLatestPrice("psv")]);

  const heroResponse = JSON.stringify(
    pun ?? (ENDPOINTS.find((e) => e.id === "pun-today")!.response as object),
    null,
    2,
  );
  const liveCount = ENDPOINTS.filter((e) => e.status === "live").length;
  const apiTier = tierById("api");
  const annualApi = Math.round(99 * 12 * (1 - ANNUAL_DISCOUNT_PCT));

  const quickTabs = (["curl", "javascript", "python", "sheets"] as const).map((lang) => ({
    id: lang,
    label: { curl: "cURL", javascript: "JavaScript", python: "Python", sheets: "Google Sheets" }[lang],
    code: buildSnippet(ENDPOINTS.find((e) => e.id === "pun-today")!, lang),
  }));

  return (
    <div className="space-y-24 pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString({
            "@context": "https://schema.org",
            "@type": "WebAPI",
            name: "Energy Index API",
            description: DESCRIPTION,
            url: API_LANDING_URL,
            documentation: "https://energyindex.it/it/api/docs",
            termsOfService: "https://energyindex.it/it/api/docs#licenza",
            provider: organization(),
            inLanguage: "it-IT",
            offers: TIERS.filter((t) => t.priceMonthlyEur !== null).map((t) => ({
              "@type": "Offer",
              name: `Energy Index API ${t.name}`,
              price: String(t.priceMonthlyEur),
              priceCurrency: "EUR",
              url: `${API_LANDING_URL}#piani`,
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbList([
              { name: "Energy Index", url: "https://energyindex.it/it" },
              { name: "API", url: API_LANDING_URL },
            ]),
          ),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqPage(FAQ)) }} />

      {/* ============================================================ HERO */}
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(139,92,246,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.15),transparent_55%)]"
        />
        <div className="container relative mx-auto grid grid-cols-1 items-center gap-10 px-4 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                API v1 · {liveCount} endpoint live
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border">
                REST · JSON · CSV
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              I prezzi dell&apos;energia,
              <br />
              <span className="bg-gradient-to-r from-violet-600 to-emerald-500 bg-clip-text text-transparent">
                in una riga di codice.
              </span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              PUN, PSV, prezzi zonali, Energy Index delle offerte e forecast, dalle fonti ufficiali GME e ARERA.
              Si parte gratis e senza registrazione.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Zap, label: "Nessuna chiave per iniziare" },
                { icon: Globe2, label: "CORS aperto" },
                { icon: FileSpreadsheet, label: "CSV per Excel" },
                { icon: FileJson, label: "OpenAPI 3.1" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold">
                  <Icon className="size-3.5 text-violet-600 dark:text-violet-400" />
                  {label}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="#prova"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/30 transition-all hover:bg-violet-500 hover:shadow-violet-500/40"
              >
                <Zap className="size-4" /> Provala adesso
              </a>
              <a
                href="#chiave"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3 text-sm font-bold transition-colors hover:bg-muted"
              >
                <KeyRound className="size-4" /> Chiave gratuita
              </a>
              <Link
                href="/it/api/docs"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-violet-700 hover:underline dark:text-violet-400"
              >
                <BookOpen className="size-4" /> Documentazione
              </Link>
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <CodeBlock code={`curl ${API_BASE_URL}/pun/today`} title="terminale" />
            <CodeBlock code={heroResponse} title={pun ? "risposta live · 200 OK" : "risposta di esempio"} json maxHeight="22rem" />
          </div>
        </div>

        {/* KPI strip */}
        <div className="container relative mx-auto grid grid-cols-2 gap-3 px-4 pb-10 md:grid-cols-4">
          {[
            { k: pun ? `${fmt(pun.value_native ?? pun.value)} €/MWh` : "PUN", l: pun ? `PUN del ${pun.date.split("-").reverse().join("/")}` : "Prezzo Unico Nazionale" },
            { k: "7", l: "zone di mercato (nazionale + 6)" },
            { k: String(ENDPOINTS.length), l: "endpoint nel catalogo" },
            { k: "0 €", l: "per iniziare, senza registrazione" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border bg-card/80 p-4 backdrop-blur">
              <div className="font-mono text-2xl font-black tabular-nums sm:text-3xl">{s.k}</div>
              <div className="text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ USE CASES */}
      <section className="container mx-auto space-y-8 px-4" id="esempi">
        <SectionHeader
          eyebrow="Cosa puoi costruire"
          title="Otto idee, pronte da copiare"
          subtitle="Ogni esempio indica il piano e gli endpoint che servono. I valori di PUN e PSV nei riquadri sono quelli di oggi; il resto e' illustrativo."
        />
        <UseCases pun={pun?.value_native ?? null} psv={psv?.value_native ?? null} />
      </section>

      {/* ============================================================ 3 STEPS */}
      <section className="container mx-auto space-y-8 px-4">
        <SectionHeader eyebrow="Come funziona" title="Dal nulla al dato in 30 secondi" />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              n: "1",
              icon: Link2,
              title: "Scegli l'endpoint",
              text: "Parti da /pun/today: nessuna chiave, nessuna registrazione.",
              code: "GET /api/v1/pun/today",
            },
            {
              n: "2",
              icon: Braces,
              title: "Leggi il JSON",
              text: "Valore in €/kWh e €/MWh, data, fonte ufficiale e link di dettaglio.",
              code: '"value_native": 118.73',
            },
            {
              n: "3",
              icon: ShieldCheck,
              title: "Cita la fonte",
              text: "Mostra 'Fonte: Energy Index' con un link. Il testo e' gia' nella risposta.",
              code: '"attribution": "Energy Index…"',
            },
          ].map((s) => (
            <div key={s.n} className="relative overflow-hidden rounded-2xl border bg-card p-6">
              <span aria-hidden className="absolute -right-3 -top-6 font-black text-[7rem] leading-none text-muted/80 select-none">
                {s.n}
              </span>
              <div className="relative space-y-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/25">
                  <s.icon className="size-5" />
                </span>
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.text}</p>
                <code className="inline-block rounded-md bg-stone-950 px-2.5 py-1 font-mono text-xs text-emerald-300">{s.code}</code>
              </div>
            </div>
          ))}
        </div>
        <CodeTabs tabs={quickTabs} />
      </section>

      {/* ============================================================ PRICING */}
      <section className="container mx-auto space-y-8 px-4" id="piani">
        <SectionHeader
          eyebrow="Piani"
          title="Gratis per iniziare, 99 € quando vai in produzione"
          subtitle="I dati ufficiali grezzi restano gratuiti. Si paga per storico completo, dati orari, forecast, alert e volumi."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {TIERS.filter((t) => ["open", "developer", "api"].includes(t.id)).map((t) => (
            <div
              key={t.id}
              className={cn(
                "relative flex flex-col rounded-3xl border bg-card p-7",
                t.highlight && "ring-2 shadow-2xl shadow-violet-500/15 lg:-translate-y-2",
                t.highlight && TIER_STYLE[t.id].ring,
              )}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow">
                  Consigliato per la produzione
                </span>
              )}
              <div className="flex items-center justify-between">
                <h3 className={cn("text-2xl font-black", TIER_STYLE[t.id].text)}>{t.name}</h3>
                <TierBadge tier={t.id} />
              </div>
              <p className="mt-2 min-h-10 text-sm text-muted-foreground">{t.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-5xl font-black tracking-tight">{formatTierPrice(t)}</span>
                {t.priceMonthlyEur ? <span className="text-sm text-muted-foreground">/mese + IVA</span> : null}
              </div>
              {t.id === "api" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  oppure {annualApi.toLocaleString("it-IT")} €/anno (−{Math.round(ANNUAL_DISCOUNT_PCT * 100)}%)
                </p>
              )}
              <dl className="mt-6 grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Accesso", t.auth],
                  ["Volume", t.quota],
                  ["Storico", t.history],
                  ["Attribuzione", t.attribution],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-muted/60 p-2.5">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className={cn("mt-0.5 size-4 shrink-0", TIER_STYLE[t.id].text)} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={t.cta.href}
                className={cn(
                  "mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all",
                  t.highlight
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500"
                    : "border bg-background hover:bg-muted",
                )}
              >
                {t.cta.label} <ArrowRight className="size-4" />
              </a>
            </div>
          ))}
        </div>

        {/* Piani EIDX Pro: API incluse */}
        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.filter((t) => ["pro", "trading", "enterprise"].includes(t.id)).map((t) => (
            <a
              key={t.id}
              href={t.cta.href}
              className="group flex items-center justify-between gap-4 rounded-2xl border bg-gradient-to-br from-amber-400/10 to-transparent p-5 transition-all hover:shadow-lg"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black">{t.name}</span>
                  <span className="rounded-md bg-gradient-to-br from-amber-300 to-amber-500 px-1.5 py-0.5 text-[10px] font-black tracking-[0.15em] text-stone-900">
                    EIDX PRO
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.tagline}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-black">{formatTierPrice(t)}</div>
                {t.priceMonthlyEur ? <div className="text-[10px] text-muted-foreground">/mese, API incluse</div> : null}
              </div>
            </a>
          ))}
        </div>

        {/* Matrice di confronto */}
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-3 text-left font-semibold">Cosa include</th>
                {MATRIX_TIERS.map((id) => (
                  <th key={id} className="p-3 text-center">
                    <div className={cn("font-black", TIER_STYLE[id].text)}>{tierById(id).name}</div>
                    <div className="text-[11px] font-normal text-muted-foreground">{formatTierPrice(tierById(id))}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="p-3 font-medium">{row.label}</td>
                  {MATRIX_TIERS.map((id) => (
                    <td key={id} className={cn("p-3 text-center", id === "api" && "bg-violet-500/5")}>
                      {row.values ? (
                        <span className="text-xs font-semibold">{row.values[id]}</span>
                      ) : RANK[id] >= RANK[row.min!] ? (
                        <Check className={cn("mx-auto size-4", TIER_STYLE[id].text)} aria-label="incluso" />
                      ) : (
                        <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="non incluso" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Prezzi IVA esclusa. Il piano {apiTier.name} e i piani EIDX Pro sono in fase di lancio: richiedi l&apos;accesso e ti
          attiviamo appena il rilascio automatico delle chiavi e&apos; pronto.
        </p>
      </section>

      {/* ============================================================ CATALOG */}
      <section className="container mx-auto space-y-8 px-4" id="endpoint">
        <SectionHeader
          eyebrow="Catalogo"
          title="Tutti gli endpoint, a colpo d'occhio"
          subtitle="Il colore indica il piano minimo. 'Live' risponde gia' oggi; 'In arrivo' ha contratto pubblicato e sara' attivato a breve."
        />
        <div className="flex flex-wrap gap-2">
          {MATRIX_TIERS.map((id) => (
            <TierBadge key={id} tier={id} />
          ))}
        </div>
        <div className="space-y-10">
          {CATEGORIES.map((cat) => {
            const eps = endpointsByCategory(cat.id);
            if (eps.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold">{cat.name}</h3>
                  <p className="text-sm text-muted-foreground">{cat.description}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {eps.map((e) => (
                    <Link
                      key={e.id}
                      href={`/it/api/docs#${e.id}`}
                      className={cn(
                        "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg",
                      )}
                    >
                      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", TIER_STYLE[e.tier].dot)} />
                      <div className="flex flex-wrap items-center gap-2">
                        <MethodBadge method={e.method} />
                        <StatusBadge status={e.status} />
                        <TierBadge tier={e.tier} className="ml-auto" />
                      </div>
                      <code className="break-all font-mono text-sm font-bold">{e.path}</code>
                      <div>
                        <div className="font-semibold">{e.title}</div>
                        <p className="text-sm text-muted-foreground">{e.summary}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-1 text-xs">
                        <span className="flex gap-1">
                          {e.formats.map((f) => (
                            <span key={f} className="rounded bg-muted px-1.5 py-0.5 font-mono uppercase text-muted-foreground">
                              {f}
                            </span>
                          ))}
                        </span>
                        <span className="font-semibold text-violet-700 group-hover:underline dark:text-violet-400">
                          Documentazione →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================ TRY IT */}
      <section className="container mx-auto grid grid-cols-1 gap-10 px-4 lg:grid-cols-[1fr_1.3fr] lg:items-center" id="prova">
        <div className="space-y-5">
          <SectionHeader
            align="left"
            eyebrow="Prova dal vivo"
            title="Chiama l'API da qui"
            subtitle="Sono chiamate vere agli endpoint in produzione, dal tuo browser. Quello che vedi e' esattamente cio' che riceve la tua applicazione."
          />
          <ul className="space-y-3 text-sm">
            {[
              "Risposte in cache per 15 minuti: velocissime e sempre coerenti",
              "Header CORS aperto: funziona anche da JavaScript nel browser",
              "Errori in JSON con codice leggibile (no_data, rate_limited…)",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <TryIt />
      </section>

      {/* ============================================================ WIDGET + AI */}
      <section className="container mx-auto grid grid-cols-1 gap-6 px-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5 rounded-3xl border bg-gradient-to-br from-emerald-500/10 to-transparent p-7">
          <div className="flex items-center justify-between">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Code2 className="size-5" />
            </span>
            <div className="flex gap-2">
              <TierBadge tier="open" />
              <StatusBadge status="coming" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black">Widget in una riga</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Per chi non programma: incolla lo snippet nel tuo sito e il riquadro con PUN e PSV si aggiorna da solo,
              con l&apos;attribuzione gia&apos; inclusa.
            </p>
          </div>
          <CodeBlock
            code={`<div data-eidx-widget="today" data-assets="pun,psv"></div>\n<script src="https://energyindex.it/widget.js" async></script>`}
            title="index.html"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5 rounded-3xl border bg-gradient-to-br from-violet-500/10 to-transparent p-7">
          <div className="flex items-center justify-between">
            <span className="flex size-11 items-center justify-center rounded-xl bg-violet-600 text-white">
              <Bot className="size-5" />
            </span>
            <TierBadge tier="open" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Pronta per gli agenti AI</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Spec OpenAPI importabile come tool, descrizione del sito per i modelli linguistici, risposte con fonte e
              attribuzione gia&apos; incluse: l&apos;agente cita Energy Index invece di inventare un numero.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { href: OPENAPI_URL, label: "openapi.json", sub: "OpenAPI 3.1", live: true },
              { href: "https://energyindex.it/llms.txt", label: "llms.txt", sub: "Mappa per LLM", live: true },
              { href: "#chiave", label: "Server MCP", sub: "Claude, ChatGPT, Cursor", live: false },
            ].map((x) => (
              <a key={x.label} href={x.href} className="rounded-xl border bg-card p-3 transition-colors hover:bg-muted">
                <div className="font-mono text-sm font-bold">{x.label}</div>
                <div className="text-xs text-muted-foreground">{x.sub}</div>
                <StatusBadge status={x.live ? "live" : "coming"} className="mt-2" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ LICENSE */}
      <section className="container mx-auto px-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Fonti ufficiali", text: "GME, ARERA, ICE Endex, EIA, EEX. Ogni risposta cita la sua fonte." },
            { icon: Link2, title: "Attribuzione semplice", text: "“Fonte: Energy Index” con un link. Facoltativa dal piano API." },
            { icon: Zap, title: "Limiti chiari", text: "Header X-RateLimit-* su ogni risposta, errore 429 con Retry-After." },
            { icon: BookOpen, title: "Versioni stabili", text: "/v1 non cambia in modo incompatibile. 12 mesi di preavviso per deprecazioni." },
          ].map((x) => (
            <div key={x.title} className="rounded-2xl border bg-card p-5">
              <x.icon className="size-6 text-violet-600 dark:text-violet-400" />
              <h3 className="mt-3 font-bold">{x.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{x.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ KEY FORM */}
      <section className="container mx-auto px-4" id="chiave">
        <div className="grid grid-cols-1 overflow-hidden rounded-3xl border bg-card lg:grid-cols-[1fr_1.2fr]">
          <div className="relative space-y-5 bg-gradient-to-br from-violet-700 to-violet-950 p-8 text-white lg:p-10">
            <KeyRound className="size-10 text-violet-200" />
            <h2 className="text-3xl font-black">Richiedi la tua chiave</h2>
            <p className="text-violet-100">
              Developer e&apos; gratis. Per il piano API e per EIDX Pro ti contattiamo per attivare l&apos;accesso.
            </p>
            <ul className="space-y-2 text-sm text-violet-100">
              {["Risposta entro 2 giorni lavorativi", "Nessuna carta di credito per Developer", "Avviso appena gli endpoint 'in arrivo' vanno live"].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" /> {t}
                </li>
              ))}
            </ul>
            <div className="rounded-xl bg-white/10 p-4 font-mono text-xs">
              <div className="text-violet-200"># poi, in ogni richiesta:</div>
              <div>Authorization: Bearer eidx_live_••••••••</div>
            </div>
          </div>
          <div className="p-8 lg:p-10">
            <ApiKeyRequestForm />
          </div>
        </div>
      </section>

      {/* ============================================================ FAQ */}
      <section className="container mx-auto max-w-3xl space-y-6 px-4" id="faq">
        <SectionHeader eyebrow="FAQ" title="Domande frequenti" />
        <div className="divide-y rounded-2xl border bg-card">
          {FAQ.map((f) => (
            <details key={f.question} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.question}
                <span className="text-xl text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.answer}</p>
            </details>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/it/api/docs"
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-background hover:opacity-90"
          >
            <BookOpen className="size-4" /> Leggi la documentazione completa
          </Link>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("space-y-2", align === "center" && "mx-auto max-w-2xl text-center")}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">{eyebrow}</p>
      <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
