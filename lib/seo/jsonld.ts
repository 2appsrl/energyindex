/**
 * Schema.org JSON-LD factory helpers.
 *
 * Embed: <script type="application/ld+json"
 *          dangerouslySetInnerHTML={{ __html: jsonLdString(...) }} />
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
  temporalCoverage: string;
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

export const forecastDataset = (params: {
  name: string;
  description: string;
  url: string;
  keywords: string[];
  temporalCoverage: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: params.name,
  description: params.description,
  url: params.url,
  keywords: params.keywords.join(", "),
  temporalCoverage: params.temporalCoverage,
  license: "https://energyindex.it/it/forecast/metodologia#licenza",
  isAccessibleForFree: true,
  publisher: organization(),
  creator: {
    "@type": "Organization",
    name: "EIDX Research",
    url: `${SITE_URL}/it/forecast/metodologia`,
  },
});

export interface TechArticleParams {
  headline: string;
  description: string;
  url: string;
  author: string;
  datePublished: string;       // ISO 8601 YYYY-MM-DD
  dateModified?: string;
  keywords?: string[];
}

export const techArticle = (p: TechArticleParams) => ({
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: p.headline,
  description: p.description,
  url: p.url,
  inLanguage: "it-IT",
  author: {
    "@type": "Organization",
    name: p.author,
    url: SITE_URL,
  },
  datePublished: p.datePublished,
  dateModified: p.dateModified ?? p.datePublished,
  keywords: p.keywords?.join(", "),
  publisher: organization(),
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
