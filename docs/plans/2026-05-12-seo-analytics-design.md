# Slice 5 — SEO + Analytics

**Data:** 2026-05-12
**Scope:** baseline tecnica SEO (metadata, OG, sitemap, robots, JSON-LD) + Plausible Analytics privacy-friendly. Zero cookie banner.

## 1. Obiettivo

Far indicizzare bene il sito da Google (rich snippets, sitemap, dataset search), abilitare share-on-social impattante (OG image con prezzo live), e misurare il traffico + conversioni verso energiapro senza GDPR friction.

## 2. Stato attuale (verificato)

- ✅ Root `app/layout.tsx` con metadata title-template + description generica
- ✅ `lang="it"` su `<html>`
- ❌ Metadata per-pagina (PUN, PSV, mercato libero ereditano la default)
- ❌ Open Graph / Twitter Card
- ❌ `sitemap.xml`, `robots.txt`
- ❌ JSON-LD structured data
- ❌ Analytics
- ❌ OG image (la default Next.js mostra un fallback testuale brutto)

## 3. Analytics: Plausible cloud

- Script `<script defer data-domain="energyindex.it" src="https://plausible.io/js/script.js" />` in `app/layout.tsx`
- 0 cookies → niente banner GDPR
- 2 eventi custom tracciati:
  - `cta_energiapro_click` — fired su click di tutte le CTA verso `https://energiapro.biz/...`
  - `zone_change` — fired su `ZoneSelector` / `ZoneMapItalia` (capire quali zone sono più esplorate)
- Setup operativo lato user: registrare `energyindex.it` su `plausible.io` (€9/mese ≤10k pv)

Helper centralizzato `lib/analytics.ts`:

```ts
declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, string | number> }) => void;
  }
}
export function trackEvent(name: string, props?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  window.plausible?.(name, props ? { props } : undefined);
}
```

## 4. Metadata per-pagina

Tutti via `generateMetadata({ params, searchParams })` per gestire dynamic data.

| Route | Title | Description |
|---|---|---|
| `/` (home redirect) | (no metadata, redirect) | — |
| `/it` | "Energy Index — Prezzi luce e gas in tempo reale" | "Osservatorio gratuito su PUN, PSV e offerte ARERA mercato libero. Confronta tariffe luce e gas in pochi click." |
| `/it/indice/pun` | "PUN oggi: {price} €/MWh — Prezzo Unico Nazionale" | "Andamento storico e attuale del PUN, prezzo all'ingrosso dell'energia elettrica italiana. Aggiornato ogni ora dal GME." |
| `/it/indice/pun?zone=nord` | "PUN Zona {Zone} oggi: {price} €/MWh" | "Prezzo zonale {Zone} dell'energia elettrica all'ingrosso. Asta MGP del giorno prima." |
| `/it/indice/psv` | "PSV oggi: {price} €/MWh — Punto di Scambio Virtuale gas" | "Andamento del PSV, prezzo all'ingrosso del gas naturale italiano. Aggiornato ogni giorno dal GME (MGP-GAS)." |
| `/it/mercato-libero` | "Mercato libero luce e gas: {N} offerte PLACET ARERA" | "Osservatorio statistico delle offerte mercato libero. Confronto mediana fissa vs variabile su luce e gas, 12 mesi di storico." |
| `/it/mercato-libero/ticker` | "Market Map: tutte le offerte luce e gas in tempo reale" | "Mappa interattiva di tutte le 1.500+ offerte PLACET pubblicate dal Portale Offerte ARERA. Cerca fornitore, confronta prezzi." |

Tutti: OG + Twitter Card con title/description/image, `metadataBase: new URL("https://energyindex.it")`.

## 5. OG image dinamica per-route

Usa `next/og` (`ImageResponse`) — file convention `opengraph-image.tsx`.

| Route | OG image contenuto |
|---|---|
| Default (app/opengraph-image.tsx) | Logo + tagline "Energy Index · prezzi luce e gas in tempo reale" |
| `/it/indice/[slug]` | Logo + nome asset (es. "PUN") + valore corrente XXL ("146,42 €/MWh") + delta ("▼ 5,8% vs ieri") |
| `/it/mercato-libero` | Logo + "{N} offerte ARERA · mediana luce {X} €/kWh · mediana gas {Y} €/Smc" |
| `/it/mercato-libero/ticker` | Logo + "Market Map · tutte le offerte" (statico) |

Risoluzione 1200×630 (standard OG). Generata server-side, cacheable (revalidate 1h per i prezzi).

Font: usiamo il default `next/og` fino a quando non sarà chiaro che serve un custom.

## 6. sitemap.xml dinamica

`app/sitemap.ts` enumera:
- `/it`
- `/it/indice/pun`
- `/it/indice/pun?zone=nord` ... 6 zone
- `/it/indice/psv`
- `/it/mercato-libero`
- `/it/mercato-libero/ticker`

= 11 URL totali. Lastmod = `new Date()` (cambia ad ogni build/render, accettabile per ora).

```ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://energyindex.it";
  const now = new Date();
  const zones = ["nord", "cnor", "csud", "sud", "sici", "sard"];
  return [
    { url: `${base}/it`, lastModified: now, priority: 1.0 },
    { url: `${base}/it/indice/pun`, lastModified: now, priority: 0.9 },
    ...zones.map((z) => ({
      url: `${base}/it/indice/pun?zone=${z}`,
      lastModified: now,
      priority: 0.7,
    })),
    { url: `${base}/it/indice/psv`, lastModified: now, priority: 0.9 },
    { url: `${base}/it/mercato-libero`, lastModified: now, priority: 0.9 },
    { url: `${base}/it/mercato-libero/ticker`, lastModified: now, priority: 0.7 },
  ];
}
```

## 7. robots.txt dinamica

`app/robots.ts`:

```ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://energyindex.it/sitemap.xml",
  };
}
```

## 8. JSON-LD structured data

Helper `lib/seo/jsonld.ts` con factory functions tipate. Embed via `<script type="application/ld+json" dangerouslySetInnerHTML={...} />`.

| Schema | Dove | Cosa serve |
|---|---|---|
| `Organization` | `app/layout.tsx` root | Logo, nome, URL, sameAs (energiapro.biz) |
| `WebSite` | `app/layout.tsx` root | Nome sito + URL — Google sitelinks search box (opzionale) |
| `Dataset` | `/it/indice/pun` + `/it/indice/psv` | Distribution URL (link al chart), license (open data), keywords (PUN, energy price, italy) — Google Dataset Search indexa |
| `FAQPage` | tutte le pagine con FAQ (PUN, PSV, mercato libero) | Lista Q&A — rich snippet con domande espandibili in SERP |
| `BreadcrumbList` | tutte le pagine non-home | Home > [Indice] > PUN — breadcrumb in SERP |

## 9. Files toccati

**Nuovi**:
- `app/sitemap.ts`
- `app/robots.ts`
- `app/opengraph-image.tsx` (default)
- `app/[locale]/indice/[slug]/opengraph-image.tsx`
- `app/[locale]/mercato-libero/opengraph-image.tsx`
- `lib/analytics.ts`
- `lib/seo/jsonld.ts`

**Modificati**:
- `app/layout.tsx` — Plausible script + JSON-LD Organization+WebSite + metadataBase
- `app/[locale]/page.tsx` — metadata + breadcrumb
- `app/[locale]/indice/[slug]/page.tsx` — `generateMetadata` (dynamic title/desc) + JSON-LD Dataset+FAQPage+Breadcrumb
- `app/[locale]/mercato-libero/page.tsx` — `generateMetadata` + FAQPage + Breadcrumb
- `app/[locale]/mercato-libero/ticker/page.tsx` — `generateMetadata` polished
- `components/CtaToEnergiapro.tsx` — onClick `trackEvent('cta_energiapro_click', { campaign })`
- `components/chart/ZoneSelector.tsx` + `ZoneMapItalia.tsx` — track `zone_change` (lato client, su navigation)

## 10. Setup operativo richiesto a user

1. Account Plausible su `plausible.io`, aggiungere site `energyindex.it`
2. (Opzionale) configurare goal/funnel su Plausible: "cta_energiapro_click" e "zone_change"
3. Verifica Google Search Console — aggiungere proprietà `energyindex.it`, sottomettere `sitemap.xml`

## 11. Out of scope (rinviato)

- Cookie consent banner (non serve con Plausible)
- GA4
- Heatmaps / session recording
- A/B testing
- PWA manifest / install prompt
- AMP
- Multilingua EN (oggi solo IT)
- Schema.org `PriceSpecification` su offerte ARERA singole (troppe, scarso ROI)
- `hreflang` (single-locale)

## 12. Rischi

- **OG image rendering lentezza**: `ImageResponse` può essere lento (~500ms). Mitigazione: cache headers + Next.js auto-cache (revalidate). Per i dati live PUN/PSV usiamo `revalidate = 3600`.
- **Plausible script blocker**: alcuni utenti hanno adblock che bloccano Plausible → pageview perdute (~10-20%). Accettabile, è privacy-friendly.
- **Dataset JSON-LD**: Google potrebbe rifiutarlo se mancano campi critici (publisher, distribution). Validare con Rich Results Test prima del deploy.
- **Plausible costi**: €9/mese fino a 10k pageview. Sopra → upgrade. Non un problema all'inizio.
