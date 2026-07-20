# Slice 5 — SEO + Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggiungere baseline SEO completa (metadata per-pagina, OG dinamici, sitemap, robots, JSON-LD) + Plausible Analytics privacy-friendly con eventi custom per il funnel verso energiapro.

**Architecture:** Tutto via Next.js 16 file conventions (`sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, `generateMetadata`). Plausible via singolo `<script>` in layout root. JSON-LD via `<script type="application/ld+json">` inline. Eventi custom client-side via helper `lib/analytics.ts`.

**Tech Stack:** Next.js 16 (File conventions + ImageResponse), Plausible cloud, schema.org JSON-LD.

**Design doc:** `docs/plans/2026-05-12-seo-analytics-design.md`

---

## Task 1 — `lib/analytics.ts` + `metadataBase` su root

**Files:**
- Create: `lib/analytics.ts`
- Create: `tests/lib/analytics.test.ts`
- Modify: `app/layout.tsx`

TDD: helper puro.

### Step 1: Failing test

`tests/lib/analytics.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "@/lib/analytics";

describe("trackEvent", () => {
  beforeEach(() => {
    delete (window as { plausible?: unknown }).plausible;
  });

  it("does nothing if plausible is not loaded", () => {
    expect(() => trackEvent("foo")).not.toThrow();
  });

  it("calls window.plausible with event name only when no props", () => {
    const spy = vi.fn();
    (window as { plausible?: unknown }).plausible = spy;
    trackEvent("test_event");
    expect(spy).toHaveBeenCalledWith("test_event", undefined);
  });

  it("wraps props under { props } when passed", () => {
    const spy = vi.fn();
    (window as { plausible?: unknown }).plausible = spy;
    trackEvent("zone_change", { zone: "nord" });
    expect(spy).toHaveBeenCalledWith("zone_change", { props: { zone: "nord" } });
  });

  it("is safe on SSR (no window)", () => {
    const originalWindow = global.window;
    // @ts-expect-error simulate SSR
    delete global.window;
    expect(() => trackEvent("ssr_safe")).not.toThrow();
    global.window = originalWindow;
  });
});
```

### Step 2: Run, verify FAIL

```bash
npx vitest run tests/lib/analytics.test.ts
```
Expected: module not found.

### Step 3: Implement

`lib/analytics.ts`:

```ts
/**
 * Plausible analytics helper — client-side only, SSR-safe.
 *
 * Setup: <script defer data-domain="energyindex.it" src="https://plausible.io/js/script.js" />
 * caricato in app/layout.tsx. Lo script registra window.plausible() globale.
 */
declare global {
  interface Window {
    plausible?: (
      event: string,
      opts?: { props?: Record<string, string | number> },
    ) => void;
  }
}

export function trackEvent(
  name: string,
  props?: Record<string, string | number>,
): void {
  if (typeof window === "undefined") return;
  if (!window.plausible) return;
  window.plausible(name, props ? { props } : undefined);
}
```

### Step 4: Run, verify PASS

```bash
npx vitest run tests/lib/analytics.test.ts
```
Expected: 4 passed.

### Step 5: Run full suite

```bash
npx vitest run
```
Expected: 47 passed (43 + 4 new).

### Step 6: Update root layout

Modify `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://energyindex.it"),
  title: { default: "Energy Index", template: "%s | Energy Index" },
  description: "Osservatorio prezzi luce e gas in tempo reale.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={inter.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
        <Script
          defer
          data-domain="energyindex.it"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
```

### Step 7: Verify build

```bash
npm run build 2>&1 | tail -5
```
Expected: success.

### Step 8: Commit

```bash
git add lib/analytics.ts tests/lib/analytics.test.ts app/layout.tsx
git commit -m "feat(analytics): Plausible script in root layout + trackEvent helper + metadataBase"
```

---

## Task 2 — robots.ts + sitemap.ts

**Files:**
- Create: `app/robots.ts`
- Create: `app/sitemap.ts`

Nessun test unitario — sono file convention Next.js, verifica via build + route.

### Step 1: Create `app/robots.ts`

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://energyindex.it/sitemap.xml",
  };
}
```

### Step 2: Create `app/sitemap.ts`

```ts
import type { MetadataRoute } from "next";

const BASE = "https://energyindex.it";
const ZONES = ["nord", "cnor", "csud", "sud", "sici", "sard"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/it`, lastModified: now, priority: 1.0, changeFrequency: "hourly" },
    { url: `${BASE}/it/indice/pun`, lastModified: now, priority: 0.9, changeFrequency: "hourly" },
    ...ZONES.map((z) => ({
      url: `${BASE}/it/indice/pun?zone=${z}`,
      lastModified: now,
      priority: 0.7 as const,
      changeFrequency: "hourly" as const,
    })),
    { url: `${BASE}/it/indice/psv`, lastModified: now, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/it/mercato-libero`, lastModified: now, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/it/mercato-libero/ticker`, lastModified: now, priority: 0.7, changeFrequency: "daily" },
  ];
}
```

### Step 3: Verify build

```bash
npm run build 2>&1 | tail -10
```
Expected: route output mostra `/robots.txt` e `/sitemap.xml` come static.

### Step 4: Smoke check (post-deploy)

Solo nota: dopo merge, `https://energyindex.it/robots.txt` deve servire il content giusto. `https://energyindex.it/sitemap.xml` deve listare gli 11 URL.

### Step 5: Commit

```bash
git add app/robots.ts app/sitemap.ts
git commit -m "feat(seo): sitemap.xml dinamica (11 URL) + robots.txt"
```

---

## Task 3 — Helper JSON-LD `lib/seo/jsonld.ts` + Organization+WebSite root

**Files:**
- Create: `lib/seo/jsonld.ts`
- Modify: `app/layout.tsx`

### Step 1: Implement `lib/seo/jsonld.ts`

```ts
/**
 * Schema.org JSON-LD factory helpers.
 *
 * Embed: <script type="application/ld+json"
 *          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
 *
 * Validate con Google Rich Results Test:
 *   https://search.google.com/test/rich-results
 */

const SITE_URL = "https://energyindex.it";

export interface Breadcrumb {
  name: string;
  url: string;
}

export const organization = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Energy Index",
  url: SITE_URL,
  logo: `${SITE_URL}/opengraph-image`,
  sameAs: ["https://energiapro.biz"],
  description: "Osservatorio prezzi luce e gas in tempo reale per il mercato italiano.",
});

export const website = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Energy Index",
  url: SITE_URL,
  inLanguage: "it-IT",
});

export const breadcrumbList = (items: Breadcrumb[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((b, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: b.name,
    item: b.url,
  })),
});

export const dataset = (params: {
  name: string;
  description: string;
  url: string;
  keywords: string[];
  temporalCoverage: string; // es. "2021-05-07/.."
}) => ({
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: params.name,
  description: params.description,
  url: params.url,
  keywords: params.keywords.join(", "),
  temporalCoverage: params.temporalCoverage,
  license: "https://www.gme.it/it-it/Legal/CondizioniUtilizzo",
  isAccessibleForFree: true,
  publisher: organization(),
  creator: {
    "@type": "Organization",
    name: "GME — Gestore dei Mercati Energetici",
    url: "https://www.mercatoelettrico.org",
  },
});

export interface FaqEntry {
  question: string;
  answer: string;
}

export const faqPage = (entries: FaqEntry[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: entries.map((e) => ({
    "@type": "Question",
    name: e.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: e.answer,
    },
  })),
});

/** Serializza un oggetto JSON-LD per uso in dangerouslySetInnerHTML. */
export function jsonLdString(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
```

### Step 2: Embed Organization + WebSite in `app/layout.tsx`

In `app/layout.tsx`, dopo l'apertura di `<body>`, prima di `{children}`:

```tsx
import { organization, website, jsonLdString } from "@/lib/seo/jsonld";

// ... inside RootLayout return:
<body className="bg-background text-foreground font-sans antialiased">
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: jsonLdString(organization()) }}
  />
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: jsonLdString(website()) }}
  />
  {children}
  <Script ... />
</body>
```

### Step 3: Typecheck + build

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```
Expected: clean, success.

### Step 4: Commit

```bash
git add lib/seo/jsonld.ts app/layout.tsx
git commit -m "feat(seo-jsonld): helper Organization/WebSite/BreadcrumbList/Dataset/FAQPage + root embed"
```

---

## Task 4 — generateMetadata per /it/indice/[slug] + Dataset + Breadcrumb

**Files:**
- Modify: `app/[locale]/indice/[slug]/page.tsx`

### Step 1: Update page.tsx

Aggiungi `generateMetadata` + embed JSON-LD Dataset + BreadcrumbList.

Lo slug può essere `pun` o `psv`, con `?zone=` per zone PUN. Title dinamico include il prezzo corrente.

In cima al file, dopo gli import esistenti:

```ts
import type { Metadata } from "next";
import { breadcrumbList, dataset, jsonLdString } from "@/lib/seo/jsonld";
```

Subito dopo `SOURCE_GRANULARITY_BY_SLUG`, aggiungi:

```ts
const NUMBER_2DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ zone?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { zone: zoneParam } = await searchParams;
  if (!SUPPORTED_SLUGS.includes(slug as (typeof SUPPORTED_SLUGS)[number])) {
    return { title: "Indice non trovato" };
  }
  const zone = slug === "pun" ? resolveZone(zoneParam) : null;
  const effectiveSlug = zone ? zone.slug : slug;

  // Lookup ultimo prezzo per il title dinamico
  const supabase = await createServerClient();
  const { data: latest } = await supabase
    .from("price_observations")
    .select("value")
    .eq("asset_id", (await supabase
      .from("assets").select("id").eq("slug", effectiveSlug).single()).data?.id ?? 0)
    .lte("observed_at", new Date().toISOString())
    .order("observed_at", { ascending: false })
    .limit(1);
  const price = latest?.[0] ? Number(latest[0].value) : null;
  const priceStr = price !== null ? `${NUMBER_2DP.format(price)} €/MWh` : "—";

  const isPun = slug === "pun";
  const zoneLabel = zone && !zone.isNational ? ` Zona ${zone.displayShort}` : "";

  const title = isPun
    ? `PUN${zoneLabel} oggi: ${priceStr}`
    : `PSV oggi: ${priceStr} — Punto di Scambio Virtuale gas`;

  const description = isPun
    ? `Andamento e prezzo attuale del PUN${zoneLabel}, riferimento all'ingrosso dell'energia elettrica italiana. Storico 5 anni, aggiornato ogni ora dal GME.`
    : "Andamento del PSV (Punto di Scambio Virtuale), prezzo all'ingrosso del gas naturale italiano. Storico 5 anni, aggiornato ogni giorno dal GME MGP-GAS.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "it_IT",
      url: zone && !zone.isNational
        ? `/it/indice/${slug}?zone=${zone.code}`
        : `/it/indice/${slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
```

### Step 2: Embed JSON-LD nella return JSX

Subito dopo l'apertura del div container (riga `<div className="container mx-auto px-4 py-8 space-y-8">`), prima dell'`<header>`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: jsonLdString(
      dataset({
        name: slug === "pun" ? "PUN — Prezzo Unico Nazionale (Italia)" : "PSV — Punto di Scambio Virtuale gas (Italia)",
        description:
          slug === "pun"
            ? "Serie storica del Prezzo Unico Nazionale dell'energia elettrica italiana, asta MGP del giorno prima. Dati orari dal 2021."
            : "Serie storica del prezzo PSV per il gas naturale italiano, asta MGP-GAS. Dati giornalieri dal 2021.",
        url: `https://energyindex.it/it/indice/${slug}`,
        keywords:
          slug === "pun"
            ? ["PUN", "Prezzo Unico Nazionale", "energia elettrica", "Italia", "GME", "MGP", "day-ahead"]
            : ["PSV", "Punto di Scambio Virtuale", "gas naturale", "Italia", "GME", "MGP-GAS"],
        temporalCoverage: "2021-05-07/..",
      }),
    ),
  }}
/>
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: jsonLdString(
      breadcrumbList([
        { name: "Home", url: "https://energyindex.it/it" },
        { name: assetMeta.display_name_it, url: `https://energyindex.it/it/indice/${slug}` },
      ]),
    ),
  }}
/>
```

### Step 3: Typecheck + build

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```
Expected: clean, success. La route `/it/indice/[slug]` continua a essere dinamica.

### Step 4: Commit

```bash
git add 'app/[locale]/indice/[slug]/page.tsx'
git commit -m "feat(seo-indice): generateMetadata dinamico con prezzo corrente + Dataset+Breadcrumb JSON-LD"
```

---

## Task 5 — FAQ JSON-LD (PUN + PSV + mercato libero)

**Files:**
- Modify: `components/FaqSection.tsx`

### Step 1: Update FaqSection per emettere JSON-LD inline

Il component oggi legge il markdown, parsa Q&A, renderizza HTML. Aggiungo emit JSON-LD `FAQPage` con gli stessi items.

In `components/FaqSection.tsx`, prima del `return (`:

```ts
import { faqPage, jsonLdString } from "@/lib/seo/jsonld";

// ... dopo aver parsato `items`:
const faqJsonLd = faqPage(
  items.map((item) => ({
    question: item.question,
    // L'answer e' markdown con link [text](url). Per JSON-LD usiamo la versione
    // raw (Google riconosce HTML basic). Strip dei link markdown per pulizia.
    answer: item.answer.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"),
  })),
);
```

E nel JSX, all'inizio del `<section>`:

```tsx
<section className="space-y-6">
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
  />
  <h2 className="text-2xl font-semibold tracking-tight">
    Domande frequenti
  </h2>
  {/* ... resto ... */}
</section>
```

### Step 2: Typecheck + build

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```

### Step 3: Commit

```bash
git add components/FaqSection.tsx
git commit -m "feat(seo-faq): emit JSON-LD FAQPage da ogni FaqSection per rich snippet SERP"
```

---

## Task 6 — generateMetadata + Breadcrumb su `/it/mercato-libero`

**Files:**
- Modify: `app/[locale]/mercato-libero/page.tsx`

### Step 1: Aggiungi generateMetadata

In cima al file, dopo gli import:

```ts
import type { Metadata } from "next";
import { breadcrumbList, jsonLdString } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createServerClient();
  // Quanti offerte totali al latest day
  const { data: totals } = await supabase
    .from("energy_index_aggregates")
    .select("sample_size, computed_at")
    .order("computed_at", { ascending: false })
    .limit(4);
  const total = (totals ?? []).reduce((s, r) => s + Number(r.sample_size ?? 0), 0);

  const title = total > 0
    ? `Mercato libero luce e gas: ${total} offerte PLACET ARERA`
    : "Mercato libero luce e gas — Osservatorio offerte ARERA";
  const description =
    "Osservatorio statistico delle offerte PLACET mercato libero. Confronto mediana fissa vs variabile per luce e gas, storico 12 mesi, dati ARERA aggiornati ogni giorno.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "it_IT",
      url: "/it/mercato-libero",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
```

### Step 2: Embed Breadcrumb JSON-LD

Subito dopo l'apertura `<div className="container mx-auto px-4 py-8 space-y-10">`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: jsonLdString(
      breadcrumbList([
        { name: "Home", url: "https://energyindex.it/it" },
        { name: "Mercato Libero", url: "https://energyindex.it/it/mercato-libero" },
      ]),
    ),
  }}
/>
```

### Step 3: Typecheck + build

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```

### Step 4: Commit

```bash
git add 'app/[locale]/mercato-libero/page.tsx'
git commit -m "feat(seo-mercato-libero): generateMetadata + Breadcrumb JSON-LD"
```

---

## Task 7 — generateMetadata su home + ticker, breadcrumb

**Files:**
- Modify: `app/[locale]/page.tsx`
- Modify: `app/[locale]/mercato-libero/ticker/page.tsx`

### Step 1: Home metadata

In `app/[locale]/page.tsx`, aggiungi in cima:

```ts
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Energy Index — Prezzi luce e gas in tempo reale",
  description:
    "Osservatorio gratuito su PUN (luce), PSV (gas) e offerte ARERA mercato libero. Confronta tariffe luce e gas in pochi click.",
  openGraph: {
    title: "Energy Index — Prezzi luce e gas in tempo reale",
    description:
      "Osservatorio gratuito su PUN, PSV e offerte ARERA mercato libero.",
    type: "website",
    locale: "it_IT",
    url: "/it",
  },
  twitter: {
    card: "summary_large_image",
    title: "Energy Index — Prezzi luce e gas in tempo reale",
    description: "Osservatorio gratuito su PUN, PSV e offerte ARERA mercato libero.",
  },
};
```

### Step 2: Ticker metadata refinement

Il file `app/[locale]/mercato-libero/ticker/page.tsx` ha già `metadata` statico. Migliorarlo:

```ts
export const metadata: Metadata = {
  title: "Market Map — Tutte le offerte luce e gas in tempo reale",
  description:
    "Mappa interattiva di tutte le 1.500+ offerte PLACET pubblicate dal Portale Offerte ARERA. Cerca fornitore, confronta prezzi luce e gas.",
  openGraph: {
    title: "Market Map — Tutte le offerte luce e gas",
    description:
      "Mappa interattiva di 1.500+ offerte PLACET ARERA. Cerca fornitore, confronta prezzi.",
    type: "website",
    locale: "it_IT",
    url: "/it/mercato-libero/ticker",
  },
  twitter: {
    card: "summary_large_image",
    title: "Market Map — Tutte le offerte luce e gas",
    description: "Mappa interattiva di 1.500+ offerte PLACET ARERA.",
  },
};
```

### Step 3: Typecheck + build

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -8
```

### Step 4: Commit

```bash
git add 'app/[locale]/page.tsx' 'app/[locale]/mercato-libero/ticker/page.tsx'
git commit -m "feat(seo-home-ticker): metadata per-pagina (title, description, OG, Twitter Card)"
```

---

## Task 8 — OG image default (`app/opengraph-image.tsx`)

**Files:**
- Create: `app/opengraph-image.tsx`

### Step 1: Implement

Usa `next/og` `ImageResponse`. Output 1200×630.

```tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Energy Index — Prezzi luce e gas in tempo reale";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0a 0%, #142214 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          color: "#e5e7eb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 32, color: "#14d97a", fontWeight: 700, letterSpacing: 4 }}>
          ENERGY INDEX
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, marginTop: 24, lineHeight: 1.1 }}>
          Prezzi luce e gas
          <br />
          in tempo reale
        </div>
        <div style={{ fontSize: 28, color: "#9ca3af", marginTop: 32 }}>
          PUN · PSV · offerte ARERA mercato libero
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 80,
            fontSize: 24,
            color: "#14d97a",
            fontWeight: 600,
          }}
        >
          energyindex.it
        </div>
      </div>
    ),
    { ...size },
  );
}
```

### Step 2: Verify build

```bash
npm run build 2>&1 | tail -8
```

### Step 3: Commit

```bash
git add app/opengraph-image.tsx
git commit -m "feat(og-image): default OG image 1200x630 generata server-side (next/og ImageResponse)"
```

---

## Task 9 — OG image dinamica indice (`app/[locale]/indice/[slug]/opengraph-image.tsx`)

**Files:**
- Create: `app/[locale]/indice/[slug]/opengraph-image.tsx`

### Step 1: Implement

```tsx
import { ImageResponse } from "next/og";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "Energy Index — Prezzo asset";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Cache l'OG per 1h
export const revalidate = 3600;

const NUMBER_2DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function Image({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const supabase = await createServerClient();
  const { data: meta } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, display_name_it, unit")
    .eq("asset_slug", params.slug)
    .maybeSingle();

  if (!meta) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#fff", fontSize: 48, fontFamily: "system-ui" }}>
          Energy Index
        </div>
      ),
      { ...size },
    );
  }

  const { data: latestRows } = await supabase
    .from("price_observations")
    .select("value")
    .eq("asset_id", meta.asset_id)
    .lte("observed_at", new Date().toISOString())
    .order("observed_at", { ascending: false })
    .limit(2);

  const value = latestRows?.[0] ? Number(latestRows[0].value) : null;
  const prev = latestRows?.[1] ? Number(latestRows[1].value) : null;
  const deltaPct = value !== null && prev !== null && prev !== 0 ? ((value - prev) / prev) * 100 : null;
  const deltaColor = deltaPct !== null && deltaPct >= 0 ? "#f43f5e" : "#14d97a";
  const deltaSym = deltaPct !== null ? (deltaPct >= 0 ? "▲" : "▼") : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0a 0%, #142214 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "70px 80px",
          color: "#e5e7eb",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 28, color: "#14d97a", fontWeight: 700, letterSpacing: 4 }}>
          ENERGY INDEX
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, marginTop: 60, color: "#9ca3af" }}>
          {meta.display_name_it}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 28, gap: 32 }}>
          <div style={{ fontSize: 128, fontWeight: 800, color: "#fff", letterSpacing: -2 }}>
            {value !== null ? NUMBER_2DP.format(value) : "—"}
          </div>
          <div style={{ fontSize: 40, color: "#9ca3af" }}>
            {meta.unit}
          </div>
        </div>
        {deltaPct !== null && (
          <div style={{ fontSize: 36, color: deltaColor, fontWeight: 700, marginTop: 16 }}>
            {deltaSym} {Math.abs(deltaPct).toFixed(1)}% vs ora precedente
          </div>
        )}
        <div style={{ position: "absolute", bottom: 50, right: 80, fontSize: 24, color: "#14d97a", fontWeight: 600 }}>
          energyindex.it
        </div>
      </div>
    ),
    { ...size },
  );
}
```

### Step 2: Build

```bash
npm run build 2>&1 | tail -8
```

### Step 3: Commit

```bash
git add 'app/[locale]/indice/[slug]/opengraph-image.tsx'
git commit -m "feat(og-indice): OG image dinamica con prezzo live + delta% per /it/indice/[slug]"
```

---

## Task 10 — OG image mercato libero

**Files:**
- Create: `app/[locale]/mercato-libero/opengraph-image.tsx`

### Step 1: Implement

```tsx
import { ImageResponse } from "next/og";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "Mercato Libero — Offerte ARERA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const NUMBER_4DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export default async function Image() {
  const supabase = await createServerClient();
  const { data: latest } = await supabase
    .from("energy_index_aggregates")
    .select("aggregate_slug, median, sample_size, computed_at, unit")
    .order("computed_at", { ascending: false })
    .limit(4);

  const byKey = new Map<string, { median: number; n: number; unit: string }>();
  for (const r of (latest ?? []) as Array<{
    aggregate_slug: string;
    median: number | string;
    sample_size: number;
    unit: string;
  }>) {
    if (!byKey.has(r.aggregate_slug)) {
      byKey.set(r.aggregate_slug, {
        median: Number(r.median),
        n: r.sample_size,
        unit: r.unit,
      });
    }
  }
  const total = Array.from(byKey.values()).reduce((s, x) => s + x.n, 0);
  const luce = byKey.get("mercato-libero-luce-fissa");
  const gas = byKey.get("mercato-libero-gas-fissa");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0a 0%, #142214 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "70px 80px",
          color: "#e5e7eb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 28, color: "#14d97a", fontWeight: 700, letterSpacing: 4 }}>
          ENERGY INDEX
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, marginTop: 30, lineHeight: 1.05 }}>
          Mercato Libero
        </div>
        <div style={{ fontSize: 32, color: "#9ca3af", marginTop: 12 }}>
          {total} offerte PLACET · ARERA · aggiornate ogni giorno
        </div>
        <div style={{ display: "flex", gap: 60, marginTop: 60 }}>
          {luce && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, color: "#14d97a", fontWeight: 600 }}>LUCE FISSA mediana</div>
              <div style={{ fontSize: 56, color: "#fff", fontWeight: 700, marginTop: 6 }}>
                {NUMBER_4DP.format(luce.median)} <span style={{ fontSize: 28, color: "#9ca3af" }}>{luce.unit}</span>
              </div>
            </div>
          )}
          {gas && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, color: "#fb923c", fontWeight: 600 }}>GAS FISSO mediana</div>
              <div style={{ fontSize: 56, color: "#fff", fontWeight: 700, marginTop: 6 }}>
                {NUMBER_4DP.format(gas.median)} <span style={{ fontSize: 28, color: "#9ca3af" }}>{gas.unit}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ position: "absolute", bottom: 50, right: 80, fontSize: 24, color: "#14d97a", fontWeight: 600 }}>
          energyindex.it/it/mercato-libero
        </div>
      </div>
    ),
    { ...size },
  );
}
```

### Step 2: Build

```bash
npm run build 2>&1 | tail -8
```

### Step 3: Commit

```bash
git add 'app/[locale]/mercato-libero/opengraph-image.tsx'
git commit -m "feat(og-mercato-libero): OG dinamica con mediana luce/gas + count offerte"
```

---

## Task 11 — Event tracking CTA energiapro

**Files:**
- Modify: `components/CtaToEnergiapro.tsx`

### Step 1: Add onClick tracking

`CtaToEnergiapro` è un `<a>` esterno. Aggiungo `onClick` con `trackEvent`.

NB: il component oggi è server-rendered (RSC). Per usare `onClick` deve diventare client component. Aggiungere `"use client"` in cima.

Sostituire intero file:

```tsx
"use client";

import { Zap } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function CtaToEnergiapro({ campaign }: { campaign: string }) {
  const url = `https://energiapro.biz/?utm_source=energy-index&utm_medium=cta&utm_campaign=${encodeURIComponent(campaign)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      onClick={() => trackEvent("cta_energiapro_click", { campaign })}
      aria-label="Vai al comparatore EnergiaPro"
      className="group relative block cursor-pointer overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 sm:p-10 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Risparmia in bolletta
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Trova la tariffa migliore per te
          </h3>
          <p className="text-base text-muted-foreground max-w-md">
            Confronta le offerte luce e gas del mercato libero in pochi
            secondi. Gratis e senza impegno.
          </p>
          <p className="pt-1 text-xs text-muted-foreground/80">
            Powered by{" "}
            <span className="font-semibold text-primary">EnergiaPro</span>
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-primary/40">
          Vai al comparatore
        </span>
      </div>
    </a>
  );
}
```

### Step 2: Typecheck + build

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```

### Step 3: Commit

```bash
git add components/CtaToEnergiapro.tsx
git commit -m "feat(analytics-cta): track click su CTA energiapro con campaign label per Plausible"
```

---

## Task 12 — Event tracking zone changes

**Files:**
- Modify: `components/chart/ZoneSelector.tsx`
- Modify: `components/chart/ZoneMapItalia.tsx`

### Step 1: ZoneSelector

Il component è server-component con `<Link>`. Per tracciare il click serve `onClick`, che richiede client component. Conversione:

```tsx
"use client";

import Link from "next/link";
import { PUN_ZONES, type ZoneCode } from "@/lib/pun-zones";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

export function ZoneSelector({
  active,
  basePath,
  preserveTf,
}: {
  active: ZoneCode;
  basePath: string;
  preserveTf?: string | null;
}) {
  return (
    <nav
      aria-label="Zona PUN"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-1"
    >
      {PUN_ZONES.map((z) => {
        const isActive = z.code === active;
        const params = new URLSearchParams();
        if (!z.isNational) params.set("zone", z.code);
        if (preserveTf) params.set("tf", preserveTf);
        const qs = params.toString();
        const href = qs ? `${basePath}?${qs}` : basePath;
        return (
          <Link
            key={z.code}
            href={href}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              if (!isActive) trackEvent("zone_change", { zone: z.code, via: "pill" });
            }}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {z.displayShort}
          </Link>
        );
      })}
    </nav>
  );
}
```

### Step 2: ZoneMapItalia

Stessa cosa, aggiungo `"use client"` (se non già) + `onClick` con trackEvent su ogni Link path.

Leggi il file corrente, modifica gli `<Link>` interni della map per aggiungere:
```tsx
onClick={() => trackEvent("zone_change", { zone: code, via: "map" })}
```
sul Link che wrappa ogni `<g>`. Stessa cosa sul "Torna a vista nazionale" link → `{ zone: "nazionale", via: "map_back" }`.

E aggiungere `"use client"` in cima al file.

### Step 3: Typecheck + build

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```

### Step 4: Commit

```bash
git add components/chart/ZoneSelector.tsx components/chart/ZoneMapItalia.tsx
git commit -m "feat(analytics-zone): track zone_change con campo via=pill|map|map_back per capire UX preference"
```

---

## Task 13 — Verify + merge

### Step 1: Test suite

```bash
npx vitest run
```
Expected: 47 passed (43 + 4 nuovi analytics).

### Step 2: Build full

```bash
npm run build 2>&1 | tail -15
```

Verifica route output include:
- `/robots.txt` (static)
- `/sitemap.xml` (static)
- `/opengraph-image` (dynamic edge)
- `/[locale]/indice/[slug]/opengraph-image` (dynamic edge)
- `/[locale]/mercato-libero/opengraph-image` (dynamic edge)

### Step 3: Smoke locale (opzionale)

`npm run dev` → visita:
- `http://localhost:3000/robots.txt`
- `http://localhost:3000/sitemap.xml`
- `http://localhost:3000/opengraph-image` → vede PNG default
- `http://localhost:3000/it/indice/pun/opengraph-image` → vede PNG con valore PUN

### Step 4: Push + merge in main

```bash
git push
git -C /Users/semronzoni/Desktop/1RangerDea/Claude/EnergyIndex fetch origin
git -C /Users/semronzoni/Desktop/1RangerDea/Claude/EnergyIndex merge --no-ff claude/wizardly-mccarthy-556b3a -m "merge: Slice 5 SEO + Plausible analytics"
git -C /Users/semronzoni/Desktop/1RangerDea/Claude/EnergyIndex push origin main
```

### Step 5: Validation post-deploy

1. Visita `https://energyindex.it/robots.txt` → vedi le rules + sitemap pointer
2. Visita `https://energyindex.it/sitemap.xml` → vedi gli 11 URL
3. Validation rich results: incolla URL su [https://search.google.com/test/rich-results](https://search.google.com/test/rich-results) → vedi Dataset/FAQPage detection
4. Test OG: incolla URL su [https://opengraph.xyz](https://opengraph.xyz) o Twitter Card Validator → vedi preview corretto

### Step 6: User setup operativo

Comunica all'utente:
1. Registrare account su [plausible.io](https://plausible.io)
2. Aggiungere site `energyindex.it`
3. Su Plausible dashboard, configurare 2 goals:
   - `cta_energiapro_click` (event)
   - `zone_change` (event)
4. (Opzionale) aggiungere `energyindex.it` su [Google Search Console](https://search.google.com/search-console) → submittare `sitemap.xml`

---

## Out of scope

- Cookie consent banner (non serve con Plausible)
- GA4 / GTM
- Heatmap / session recording
- A/B testing
- PWA manifest / install prompt
- Multilingua EN (sito è IT-only)
- Custom font per OG (usa system-ui)
- Schema.org `PriceSpecification` su singole offerte ARERA (troppe)
