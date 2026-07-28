import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** Slug degli indici che meritano una scorciatoia dalla root. */
const INDEX_SLUGS = ["pun", "psv", "ttf", "brent", "co2", "temperatura"] as const;

const nextConfig: NextConfig = {
  /**
   * Redirect permanenti (308) per gli URL "scritti a mano".
   *
   * Prima un indirizzo sconosciuto finiva in una catena inutile: il middleware
   * next-intl gli premetteva il prefisso lingua e la destinazione non esisteva
   * comunque (/pun → 307 → /it/pun → 404). Google seguiva il rimando, trovava
   * l'errore e ci riprovava, perche' il 307 dice "temporaneo".
   *
   * Qui le scorciatoie sensate diventano invece 308 verso la pagina reale.
   * I redirect di next.config sono valutati PRIMA del middleware (ordine:
   * headers → redirects → proxy/middleware), quindi non interferiscono con il
   * routing /it/... di next-intl.
   */
  async redirects() {
    return [
      // Scorciatoie brevi: /pun → /it/indice/pun. Sono gli URL che uno detta
      // a voce o scrive in un post, molto piu' dell'indirizzo completo.
      ...INDEX_SLUGS.map((slug) => ({
        source: `/${slug}`,
        destination: `/it/indice/${slug}`,
        permanent: true,
      })),
      // Percorsi corretti ma senza prefisso lingua.
      { source: "/indice/:slug", destination: "/it/indice/:slug", permanent: true },
      { source: "/forecast", destination: "/it/forecast", permanent: true },
      { source: "/forecast/:path+", destination: "/it/forecast/:path+", permanent: true },
      { source: "/mercato-libero", destination: "/it/mercato-libero", permanent: true },
      {
        source: "/mercato-libero/:path+",
        destination: "/it/mercato-libero/:path+",
        permanent: true,
      },
      { source: "/pro", destination: "/it/pro", permanent: true },
      { source: "/pro/:path+", destination: "/it/pro/:path+", permanent: true },
      { source: "/ctemachine", destination: "/it/ctemachine", permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
