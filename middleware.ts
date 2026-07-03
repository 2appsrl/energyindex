import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { defaultLocale, locales } from "./lib/i18n/config";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

// Host canonical: energyindex.it (no www).
// Tutti gli altri host autorizzati (energyindex.pro, www.energyindex.it,
// www.energyindex.pro) fanno 301 al canonical, preservando path + querystring.
// Questo redirect avviene PRIMA del next-intl middleware, cosi` il browser
// vede direttamente il dominio corretto e Google non considera duplicati.
const CANONICAL_HOST = "energyindex.it";
const HOSTS_TO_REDIRECT = new Set([
  "www.energyindex.it",
  "energyindex.pro",
  "www.energyindex.pro",
]);

export default function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";

  if (HOSTS_TO_REDIRECT.has(host)) {
    const url = new URL(request.url);
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  // Per tutti gli altri host (energyindex.it canonical, *.netlify.app preview,
  // localhost dev) deleghiamo al middleware next-intl per il routing /it/...
  return intlMiddleware(request);
}

export const config = {
  // Esclusioni dal middleware next-intl (che altrimenti forza il prefix
  // /it/ su tutto):
  //  - api/*, _next/*, _vercel/*: infrastruttura Next.js
  //  - opengraph-image, twitter-image, icon, apple-icon: Next.js metadata
  //    routes senza estensione (root-level). Senza esclusione, /opengraph-image
  //    viene redirected a /it/opengraph-image che non esiste → 404 su Google.
  //  - Qualsiasi path che contiene un punto (.jpg, .svg, .txt, .ico, ecc.):
  //    e' un asset statico, salta il routing intl.
  matcher: [
    "/((?!api|_next|_vercel|opengraph-image|twitter-image|icon|apple-icon|.*\\..*).*)",
  ],
};
