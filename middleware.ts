import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { defaultLocale, locales } from "./lib/i18n/config";
import { classifyAgent, isLoggableBot } from "./lib/traffic/classify";
import { buildRecord, hashSalt, writeRecord } from "./lib/traffic/log";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

// Host canonical: energyindex.it (no www).
// Tutti gli altri host autorizzati (energyindex.pro, www.energyindex.it,
// www.energyindex.pro) fanno 301 al canonical, preservando path + querystring.
// Eccezione: la home di .pro va a /it/pro.
// Questo redirect avviene PRIMA del next-intl middleware, cosi` il browser
// vede direttamente il dominio corretto e Google non considera duplicati.
const CANONICAL_HOST = "energyindex.it";
const HOSTS_TO_REDIRECT = new Set([
  "www.energyindex.it",
  "energyindex.pro",
  "www.energyindex.pro",
]);

const INDEX_SLUGS = ["pun", "psv", "ttf", "brent", "co2", "temperatura"] as const;

/**
 * Redirect 308 per URL "scritti a mano" e per route legacy.
 *
 * Perche' qui e non in `next.config.redirects()`: su Netlify il middleware
 * Next gira come edge function PRIMA del routing interno, quindi i redirect
 * di next.config non vengono mai raggiunti (verificato in produzione: il
 * deploy era `ready` ma /pun rispondeva ancora col 307 di next-intl).
 * Stessa ragione per cui i redirect di host in netlify.toml usano force=true.
 *
 * Il 308 e' voluto: prima un indirizzo sconosciuto riceveva il prefisso
 * lingua e finiva comunque su un 404 (/pun -> 307 -> /it/pun -> 404), e il
 * 307 diceva a Google "temporaneo, ricontrolla".
 */
const EXACT_REDIRECTS = new Map<string, string>([
  // Scorciatoie brevi: sono gli URL che uno detta a voce o scrive in un post.
  ...INDEX_SLUGS.map((slug) => [`/${slug}`, `/it/indice/${slug}`] as const),
  // Route legacy: Risk e Vitals erano pagine a se' prima che il Trading Desk
  // diventasse a schede. Gestite qui e non con permanentRedirect() nella page
  // perche' sotto un layout async la risposta e' gia' in streaming e Next
  // ripiega su un <meta http-equiv="refresh"> con status 200, non un 308.
  ["/it/pro/trading/risk", "/it/pro/trading?tab=risk"],
  ["/it/pro/trading/vitals", "/it/pro/trading?tab=vitals"],
]);

/** Sezioni raggiungibili senza prefisso lingua, sottopercorsi inclusi. */
const SECTION_PREFIXES = [
  "/indice",
  "/forecast",
  "/mercato-libero",
  "/pro",
  "/ctemachine",
] as const;

/** File letti dai crawler (e dagli LLM) che il matcher include solo per il log. */
const CRAWLER_FILES = new Set(["/llms.txt", "/robots.txt", "/sitemap.xml"]);

/** Registra la richiesta in traffic_log senza far aspettare la risposta. */
function logTraffic(kind: "api" | "bot", request: NextRequest, event: NextFetchEvent) {
  event.waitUntil(buildRecord(kind, request, hashSalt()).then(writeRecord).catch(() => {}));
}

/**
 * Area admin: rinnova la sessione Supabase Auth ad ogni richiesta e
 * scrive i cookie aggiornati sulla risposta. Senza questo passaggio i
 * server component (che non possono scrivere cookie) userebbero un token
 * scaduto e il refresh token ruotato andrebbe perso.
 */
async function withAdminSession(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname: path } = request.nextUrl;

  // API pubbliche: si registra ogni chiamata (anche quelle che poi la CDN
  // serve dalla cache, perche' il middleware gira prima) e si prosegue
  // senza toccare nient'altro: niente redirect di host, niente i18n.
  if (path === "/api/v1" || path.startsWith("/api/v1/")) {
    if (request.method !== "OPTIONS") logTraffic("api", request, event);
    return NextResponse.next();
  }

  // Pagine e file per crawler: si registrano solo i bot. I visitatori
  // umani li conta gia' Umami.
  if (isLoggableBot(classifyAgent(request.headers.get("user-agent")).kind)) {
    logTraffic("bot", request, event);
  }
  if (CRAWLER_FILES.has(path)) return NextResponse.next();

  const host = request.headers.get("host")?.toLowerCase() ?? "";

  if (HOSTS_TO_REDIRECT.has(host)) {
    const url = new URL(request.url);
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    // La home di .pro porta all'area Pro, non alla home del sito.
    if (host.endsWith("energyindex.pro") && url.pathname === "/") url.pathname = "/it/pro";
    return NextResponse.redirect(url, 301);
  }

  const { pathname, search } = request.nextUrl;

  const exact = EXACT_REDIRECTS.get(pathname);
  if (exact) {
    // La destinazione legacy porta gia' la sua querystring: in quel caso la
    // search in ingresso viene scartata, altrimenti si otterrebbe un "??".
    const target = exact.includes("?") ? exact : `${exact}${search}`;
    return NextResponse.redirect(new URL(target, request.url), 308);
  }

  // I path che iniziano gia' con /it non entrano qui: nessun prefisso della
  // lista combacia, quindi il routing normale resta intatto.
  for (const prefix of SECTION_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return NextResponse.redirect(
        new URL(`/it${pathname}${search}`, request.url),
        308,
      );
    }
  }

  // Per tutti gli altri host (energyindex.it canonical, *.netlify.app preview,
  // localhost dev) deleghiamo al middleware next-intl per il routing /it/...
  const response = intlMiddleware(request);
  if (pathname.startsWith("/it/admin")) return withAdminSession(request, response);
  return response;
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
  //  - Eccezioni esplicite, solo per il log del traffico: le API pubbliche
  //    /api/v1 e i file letti dai crawler (llms.txt, robots.txt, sitemap.xml).
  matcher: [
    "/((?!api|_next|_vercel|opengraph-image|twitter-image|icon|apple-icon|.*\\..*).*)",
    "/api/v1",
    "/api/v1/:path*",
    "/llms.txt",
    "/robots.txt",
    "/sitemap.xml",
  ],
};
