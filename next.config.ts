import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

// NB: i redirect NON vanno messi qui. Su Netlify il middleware Next gira come
// edge function prima del routing interno, quindi `redirects()` di next.config
// non viene mai raggiunto (provato: deploy `ready`, ma /pun rispondeva ancora
// col 307 di next-intl). Stanno tutti in middleware.ts.
const nextConfig: NextConfig = {
  /**
   * Disattiva lo streaming dei metadata per QUALSIASI user agent.
   *
   * Di default Next.js, quando una pagina va in streaming, non aspetta
   * generateMetadata: manda subito la UI e appende title/canonical/og in fondo
   * al <body>. Da quando `indice/[slug]` ha un loading.tsx quelle pagine sono
   * diventate streaming, e title e canonical finivano ~23 KB DOPO </head>
   * (misurato in produzione: head chiuso a 1499, canonical a 24605).
   *
   * Next.js dichiara che Googlebot interpreta comunque quei tag perche' esegue
   * JS, ma i fatti dicono altro: in Search Console "Pagina duplicata senza URL
   * canonico" e' salita da 13 a 17 e la convalida e' fallita subito dopo quel
   * deploy. E i crawler AI (OAI-SearchBot, PerplexityBot, ClaudeBot) in genere
   * NON eseguono JS: per loro la pagina risultava senza titolo e senza canonical.
   *
   * Il costo e' un TTFB piu' alto (i metadata tornano bloccanti), ma su un sito
   * che vive di citazioni in ricerca e risposte AI la correttezza dell'head vale
   * piu' di qualche centinaio di ms. Lo skeleton di loading.tsx resta.
   */
  htmlLimitedBots: /.*/,
};

export default withNextIntl(nextConfig);
