/**
 * Catalogo delle API pubbliche Energy Index — unica fonte di verita'.
 *
 * Da qui leggono:
 *  - la landing /it/api (card piani, catalogo endpoint, casi d'uso)
 *  - la documentazione tecnica /it/api/docs
 *  - la spec OpenAPI servita da /api/v1/openapi.json
 *
 * Un endpoint `status: "live"` risponde gia' in produzione; `"coming"` e'
 * documentato in anteprima: path e schema sono la proposta di contratto e
 * possono ancora cambiare prima del rilascio.
 */

export const API_BASE_URL = "https://energyindex.it/api/v1";
export const API_DOCS_URL = "https://energyindex.it/it/api/docs";
export const API_LANDING_URL = "https://energyindex.it/it/api";
export const OPENAPI_URL = "https://energyindex.it/api/v1/openapi.json";
export const API_CONTACT_EMAIL = "pro@energyindex.pro";

/**
 * Sconto sul pagamento annuale. Stesso valore di PricingSection (EIDX Pro),
 * duplicato qui perche' quel modulo e' "use client" e una costante importata
 * da un modulo client in un server component arriva come riferimento, non
 * come numero.
 */
export const ANNUAL_DISCOUNT_PCT = 0.15;

// ============================================================
// PIANI
// ============================================================

export type TierId = "open" | "developer" | "api" | "pro" | "trading" | "enterprise";

export interface ApiTier {
  id: TierId;
  name: string;
  /** Prezzo mensile in euro; 0 = gratis, null = su preventivo. */
  priceMonthlyEur: number | null;
  tagline: string;
  auth: string;
  quota: string;
  rateLimit: string;
  attribution: string;
  history: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
}

export const TIERS: readonly ApiTier[] = [
  {
    id: "open",
    name: "Open",
    priceMonthlyEur: 0,
    tagline: "Nessuna registrazione. Copia l'URL e sei online.",
    auth: "Nessuna chiave",
    quota: "Illimitata (uso ragionevole)",
    rateLimit: "60 richieste/minuto per IP",
    attribution: "Obbligatoria, con link",
    history: "Ultimi 30 giorni",
    features: [
      "Valori di oggi: PUN, PSV, TTF, Brent, CO2",
      "Serie giornaliera ultimi 30 giorni",
      "Energy Index ARERA (fisse/variabili luce e gas)",
      "Stima spesa bolletta",
      "Widget embeddabile per siti e blog",
    ],
    cta: { label: "Prova subito", href: "#prova" },
  },
  {
    id: "developer",
    name: "Developer",
    priceMonthlyEur: 0,
    tagline: "Chiave gratuita via email. Per progetti e prototipi.",
    auth: "API key gratuita",
    quota: "10.000 richieste/mese",
    rateLimit: "120 richieste/minuto",
    attribution: "Obbligatoria, con link",
    history: "Fino a 2 anni",
    features: [
      "Tutto del piano Open",
      "Storico giornaliero fino a 2 anni",
      "PUN per le 6 zone di mercato",
      "Export CSV per Excel e Google Sheets",
      "Forecast del giorno dopo (valore puntuale)",
    ],
    cta: { label: "Chiedi la chiave gratis", href: "#chiave" },
  },
  {
    id: "api",
    name: "API",
    priceMonthlyEur: 99,
    tagline: "Tutti i dati, orari e previsioni. Per prodotti in produzione.",
    auth: "API key",
    quota: "100.000 richieste/mese",
    rateLimit: "600 richieste/minuto",
    attribution: "Facoltativa",
    history: "Storico completo",
    features: [
      "Tutto del piano Developer",
      "PUN orario per zona, storico completo",
      "Forecast PUN/PSV/TTF a 7–180 giorni con bande",
      "Statistiche mercato libero e spread vs PUN/PSV",
      "Alert via webhook su soglie di prezzo",
      "Supporto email 48h",
    ],
    cta: { label: "Richiedi accesso", href: "#chiave" },
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthlyEur: 499,
    tagline: "API + tool EIDX Pro per fornitori, broker e consulenti.",
    auth: "API key",
    quota: "500.000 richieste/mese",
    rateLimit: "1.200 richieste/minuto",
    attribution: "Facoltativa",
    history: "Storico completo",
    features: [
      "Tutto del piano API",
      "Forecast 12 mesi con scenari",
      "Margin Simulator via API",
      "Accesso ai tool EIDX Pro",
    ],
    cta: { label: "Scopri EIDX Pro", href: "/it/pro" },
  },
  {
    id: "trading",
    name: "Trading",
    priceMonthlyEur: 999,
    tagline: "Indicatori quantitativi per trader desk e risk manager.",
    auth: "API key dedicata",
    quota: "2.000.000 richieste/mese",
    rateLimit: "3.000 richieste/minuto",
    attribution: "Facoltativa",
    history: "Storico completo",
    features: [
      "Tutto del piano Pro",
      "Trading Vitals: Spark Spread, ATR, cross spread",
      "Correlation matrix rolling",
      "Backtest engine via API",
    ],
    cta: { label: "Scopri EIDX Pro", href: "/it/pro" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthlyEur: null,
    tagline: "Volumi, SLA e white-label su misura.",
    auth: "API key + IP allowlist",
    quota: "Su misura",
    rateLimit: "Su misura",
    attribution: "Non richiesta (white-label)",
    history: "Storico completo + export bulk",
    features: [
      "Tutto del piano Trading",
      "Export bulk e report white-label",
      "SLA 99,9% e supporto 24h",
      "Account manager dedicato",
    ],
    cta: { label: "Contattaci", href: `mailto:${API_CONTACT_EMAIL}?subject=Energy%20Index%20API%20Enterprise` },
  },
];

const TIER_RANK: Record<TierId, number> = {
  open: 0,
  developer: 1,
  api: 2,
  pro: 3,
  trading: 4,
  enterprise: 5,
};

export function tierById(id: TierId): ApiTier {
  return TIERS.find((t) => t.id === id)!;
}

/** true se il piano `have` include quanto richiesto dal piano `need`. */
export function tierIncludes(have: TierId, need: TierId): boolean {
  return TIER_RANK[have] >= TIER_RANK[need];
}

export function formatTierPrice(t: ApiTier): string {
  if (t.priceMonthlyEur === null) return "Su misura";
  if (t.priceMonthlyEur === 0) return "Gratis";
  return `${t.priceMonthlyEur} €`;
}

// ============================================================
// ENDPOINT
// ============================================================

export type CategoryId = "prezzi" | "indici" | "forecast" | "tools" | "trading" | "automazione";

export const CATEGORIES: readonly { id: CategoryId; name: string; description: string }[] = [
  { id: "prezzi", name: "Prezzi di mercato", description: "PUN nazionale e zonale, PSV, TTF, Brent, CO2: valori del giorno e serie storiche." },
  { id: "indici", name: "Energy Index e mercato libero", description: "Gli indici proprietari costruiti sulle offerte del Portale Offerte ARERA." },
  { id: "forecast", name: "Forecast", description: "Previsioni EIDX Research con bande di confidenza e track record verificabile." },
  { id: "tools", name: "Tool di calcolo", description: "I calcolatori di Energy Index ed EIDX Pro esposti come servizio." },
  { id: "trading", name: "Trading e risk", description: "Indicatori quantitativi per desk di trading e risk management." },
  { id: "automazione", name: "Alert ed export", description: "Webhook su soglie di prezzo ed export massivi." },
];

export type EndpointStatus = "live" | "coming";
export type HttpMethod = "GET" | "POST" | "DELETE";

export interface EndpointParam {
  name: string;
  in: "path" | "query" | "body";
  type: "string" | "integer" | "number" | "boolean" | "array" | "object";
  required: boolean;
  description: string;
  example?: string | number | boolean;
  enum?: string[];
  default?: string | number | boolean;
}

export interface EndpointField {
  name: string;
  type: string;
  description: string;
}

export interface ApiEndpoint {
  /** Ancora usata nella documentazione (#id). */
  id: string;
  method: HttpMethod;
  /** Path relativo a API_BASE_URL, con parametri in {graffe}. */
  path: string;
  title: string;
  summary: string;
  description: string;
  category: CategoryId;
  /** Piano minimo che abilita l'endpoint. */
  tier: TierId;
  status: EndpointStatus;
  params: EndpointParam[];
  /** Path + querystring gia' valorizzati per gli esempi (curl, snippet). */
  exampleCall: string;
  exampleBody?: unknown;
  response: unknown;
  fields: EndpointField[];
  /** Limiti che cambiano con il piano (es. profondita' storica). */
  tierLimits?: Partial<Record<TierId, string>>;
  formats: ("json" | "csv")[];
  cache: string;
}

const ATTR = "Energy Index — https://energyindex.it (gratis, attribuzione richiesta)";

const LATEST_FIELDS: EndpointField[] = [
  { name: "date", type: "string (YYYY-MM-DD)", description: "Giorno di mercato dell'osservazione." },
  { name: "observed_at", type: "string (ISO 8601)", description: "Timestamp UTC dell'osservazione." },
  { name: "value", type: "number", description: "Valore in unita' consumer (€/kWh per energia e gas, $/bbl per Brent, €/tCO2 per CO2)." },
  { name: "unit", type: "string", description: "Unita' del campo value." },
  { name: "value_native", type: "number?", description: "Valore nell'unita' nativa della fonte (€/MWh). Assente se coincide con value." },
  { name: "unit_native", type: "string?", description: "Unita' nativa. Assente se coincide con unit." },
  { name: "asset", type: "string", description: "Sigla dell'indice (PUN, PSV, TTF, Brent, CO2)." },
  { name: "asset_name", type: "string", description: "Nome esteso dell'indice." },
  { name: "source", type: "string", description: "Fonte ufficiale del dato (GME, ICE Endex, EIA, EEX)." },
  { name: "source_url", type: "string", description: "URL della fonte ufficiale." },
  { name: "attribution", type: "string", description: "Testo di attribuzione da mostrare accanto al dato." },
  { name: "page", type: "string", description: "Pagina di dettaglio su energyindex.it da linkare." },
];

export const ENDPOINTS: readonly ApiEndpoint[] = [
  // ---------------------------------------------------------- PREZZI
  {
    id: "today",
    method: "GET",
    path: "/today",
    title: "Snapshot di tutti gli indici",
    summary: "PUN, PSV, TTF, Brent e CO2 in una sola chiamata.",
    description:
      "Restituisce l'ultimo valore disponibile di ogni indice. Pensato per dashboard e widget che mostrano una fotografia del mercato senza fare cinque richieste. Gli indici senza dato disponibile vengono omessi, non restituiti come null.",
    category: "prezzi",
    tier: "open",
    status: "live",
    params: [],
    exampleCall: "/today",
    response: {
      date: "2026-09-26",
      values: {
        PUN: { date: "2026-09-26", value: 0.11873, unit: "€/kWh", value_native: 118.73, unit_native: "€/MWh", asset: "PUN", source: "GME" },
        PSV: { date: "2026-09-26", value: 0.03902, unit: "€/kWh", value_native: 39.02, unit_native: "€/MWh", asset: "PSV", source: "GME" },
        TTF: { date: "2026-09-26", value: 0.03511, unit: "€/kWh", value_native: 35.11, unit_native: "€/MWh", asset: "TTF", source: "ICE Endex" },
        Brent: { date: "2026-09-26", value: 71.42, unit: "$/bbl", asset: "Brent", source: "EIA" },
        CO2: { date: "2026-09-26", value: 68.9, unit: "€/tCO2", asset: "CO2", source: "EEX" },
      },
      attribution: ATTR,
      source_page: "https://energyindex.it/it",
      docs: "https://energyindex.it/api/v1",
    },
    fields: [
      { name: "date", type: "string (YYYY-MM-DD)", description: "Giorno di mercato del PUN (indice principale)." },
      { name: "values", type: "object", description: "Mappa sigla → oggetto con lo stesso schema di /pun/today." },
      { name: "attribution", type: "string", description: "Testo di attribuzione da mostrare." },
      { name: "source_page", type: "string", description: "Pagina Energy Index da linkare." },
    ],
    formats: ["json"],
    cache: "15 minuti",
  },
  {
    id: "pun-today",
    method: "GET",
    path: "/pun/today",
    title: "PUN di oggi",
    summary: "Ultimo Prezzo Unico Nazionale, in €/kWh e €/MWh.",
    description:
      "Ultimo PUN pubblicato dal GME dopo la chiusura del Mercato del Giorno Prima, di norma entro il primo pomeriggio. Il valore e' fornito sia in €/kWh, comodo per ragionare in bolletta, sia nell'unita' nativa €/MWh.",
    category: "prezzi",
    tier: "open",
    status: "live",
    params: [],
    exampleCall: "/pun/today",
    response: {
      date: "2026-09-26",
      observed_at: "2026-09-26T10:30:00.000Z",
      value: 0.11873,
      unit: "€/kWh",
      value_native: 118.73,
      unit_native: "€/MWh",
      asset: "PUN",
      asset_name: "Prezzo Unico Nazionale energia elettrica Italia",
      source: "GME",
      source_url: "https://www.mercatoelettrico.org",
      attribution: ATTR,
      page: "https://energyindex.it/it/indice/pun",
    },
    fields: LATEST_FIELDS,
    formats: ["json"],
    cache: "15 minuti",
  },
  {
    id: "psv-today",
    method: "GET",
    path: "/psv/today",
    title: "PSV di oggi",
    summary: "Ultimo prezzo del gas al Punto di Scambio Virtuale.",
    description:
      "Ultimo PSV giornaliero pubblicato dal GME, in €/kWh e nell'unita' nativa €/MWh. Riferimento delle offerte gas a prezzo variabile.",
    category: "prezzi",
    tier: "open",
    status: "live",
    params: [],
    exampleCall: "/psv/today",
    response: {
      date: "2026-09-26",
      observed_at: "2026-09-26T16:00:00.000Z",
      value: 0.03902,
      unit: "€/kWh",
      value_native: 39.02,
      unit_native: "€/MWh",
      asset: "PSV",
      asset_name: "Punto di Scambio Virtuale gas naturale Italia",
      source: "GME",
      source_url: "https://www.mercatoelettrico.org",
      attribution: ATTR,
      page: "https://energyindex.it/it/indice/psv",
    },
    fields: LATEST_FIELDS,
    formats: ["json"],
    cache: "15 minuti",
  },
  {
    id: "asset-today",
    method: "GET",
    path: "/{asset}/today",
    title: "TTF, Brent e CO2 di oggi",
    summary: "Stesso schema di /pun/today per gli altri indici.",
    description:
      "Estende il pattern /{asset}/today agli indici di contesto: TTF (gas europeo), Brent (petrolio) e CO2 (quote EU ETS). Oggi questi valori sono gia' disponibili dentro /today.",
    category: "prezzi",
    tier: "open",
    status: "coming",
    params: [
      { name: "asset", in: "path", type: "string", required: true, description: "Indice richiesto.", enum: ["ttf", "brent", "co2"], example: "ttf" },
    ],
    exampleCall: "/ttf/today",
    response: {
      date: "2026-09-26",
      observed_at: "2026-09-26T17:30:00.000Z",
      value: 0.03511,
      unit: "€/kWh",
      value_native: 35.11,
      unit_native: "€/MWh",
      asset: "TTF",
      asset_name: "Title Transfer Facility gas Europa",
      source: "ICE Endex",
      source_url: "https://www.theice.com",
      attribution: ATTR,
      page: "https://energyindex.it/it/indice/ttf",
    },
    fields: LATEST_FIELDS,
    formats: ["json"],
    cache: "15 minuti",
  },
  {
    id: "prices-series",
    method: "GET",
    path: "/prices/{asset}/series",
    title: "Serie storica giornaliera",
    summary: "Un valore al giorno per qualsiasi indice, in JSON o CSV.",
    description:
      "Serie giornaliera di un indice tra due date. La profondita' storica dipende dal piano. Con format=csv la risposta e' un file CSV con separatore ';' e decimali con la virgola, pronto per Excel in italiano e per IMPORTDATA di Google Sheets.",
    category: "prezzi",
    tier: "open",
    status: "coming",
    params: [
      { name: "asset", in: "path", type: "string", required: true, description: "Indice richiesto.", enum: ["pun", "psv", "ttf", "brent", "co2"], example: "pun" },
      { name: "from", in: "query", type: "string", required: false, description: "Data iniziale inclusa (YYYY-MM-DD). Default: 30 giorni fa.", example: "2026-09-01" },
      { name: "to", in: "query", type: "string", required: false, description: "Data finale inclusa (YYYY-MM-DD). Default: oggi.", example: "2026-09-26" },
      { name: "unit", in: "query", type: "string", required: false, description: "Unita' dei valori.", enum: ["kwh", "mwh"], default: "mwh" },
      { name: "format", in: "query", type: "string", required: false, description: "Formato della risposta.", enum: ["json", "csv"], default: "json" },
    ],
    exampleCall: "/prices/pun/series?from=2026-09-20&to=2026-09-26",
    response: {
      asset: "PUN",
      unit: "€/MWh",
      from: "2026-09-20",
      to: "2026-09-26",
      count: 7,
      points: [
        { date: "2026-09-20", value: 112.4 },
        { date: "2026-09-21", value: 104.87 },
        { date: "2026-09-22", value: 121.06 },
        { date: "2026-09-23", value: 124.31 },
        { date: "2026-09-24", value: 119.52 },
        { date: "2026-09-25", value: 116.9 },
        { date: "2026-09-26", value: 118.73 },
      ],
      stats: { min: 104.87, max: 124.31, avg: 116.98 },
      attribution: ATTR,
    },
    fields: [
      { name: "asset", type: "string", description: "Sigla dell'indice." },
      { name: "unit", type: "string", description: "Unita' dei valori in points." },
      { name: "from / to", type: "string", description: "Intervallo effettivamente restituito, dopo i limiti del piano." },
      { name: "count", type: "integer", description: "Numero di punti." },
      { name: "points[]", type: "array", description: "Coppie { date, value } in ordine cronologico." },
      { name: "stats", type: "object", description: "Minimo, massimo e media dell'intervallo." },
    ],
    tierLimits: {
      open: "Ultimi 30 giorni, solo JSON",
      developer: "Fino a 2 anni, JSON e CSV",
      api: "Storico completo",
    },
    formats: ["json", "csv"],
    cache: "1 ora",
  },
  {
    id: "pun-zones",
    method: "GET",
    path: "/pun/zones",
    title: "PUN per zona di mercato",
    summary: "Prezzo giornaliero delle 6 zone MGP e del PUN nazionale.",
    description:
      "Prezzi zonali del Mercato del Giorno Prima per Nord, Centro-Nord, Centro-Sud, Sud, Sicilia e Sardegna, piu' il PUN nazionale, con lo spread di ogni zona rispetto al nazionale.",
    category: "prezzi",
    tier: "developer",
    status: "coming",
    params: [
      { name: "date", in: "query", type: "string", required: false, description: "Giorno di mercato (YYYY-MM-DD). Default: ultimo disponibile.", example: "2026-09-26" },
    ],
    exampleCall: "/pun/zones?date=2026-09-26",
    response: {
      date: "2026-09-26",
      unit: "€/MWh",
      national: 118.73,
      zones: [
        { code: "nord", name: "Nord", value: 117.95, spread_vs_pun: -0.78 },
        { code: "cnor", name: "Centro-Nord", value: 119.4, spread_vs_pun: 0.67 },
        { code: "csud", name: "Centro-Sud", value: 119.88, spread_vs_pun: 1.15 },
        { code: "sud", name: "Sud", value: 116.2, spread_vs_pun: -2.53 },
        { code: "sici", name: "Sicilia", value: 127.64, spread_vs_pun: 8.91 },
        { code: "sard", name: "Sardegna", value: 119.88, spread_vs_pun: 1.15 },
      ],
      attribution: ATTR,
    },
    fields: [
      { name: "national", type: "number", description: "PUN nazionale del giorno (€/MWh)." },
      { name: "zones[].code", type: "string", description: "Codice zona: nord, cnor, csud, sud, sici, sard." },
      { name: "zones[].value", type: "number", description: "Prezzo zonale medio giornaliero (€/MWh)." },
      { name: "zones[].spread_vs_pun", type: "number", description: "Differenza zona − PUN nazionale (€/MWh)." },
    ],
    formats: ["json", "csv"],
    cache: "1 ora",
  },
  {
    id: "pun-hourly",
    method: "GET",
    path: "/pun/hourly",
    title: "PUN orario per zona",
    summary: "Le 24 ore (96 quarti d'ora dove disponibili) per zona.",
    description:
      "Prezzi orari del MGP per il PUN nazionale o per una singola zona. E' la base per spostare i consumi nelle ore piu' economiche, calcolare profili F1/F2/F3 o ricostruire il costo di un profilo di carico reale.",
    category: "prezzi",
    tier: "api",
    status: "coming",
    params: [
      { name: "zone", in: "query", type: "string", required: false, description: "Zona di mercato.", enum: ["nazionale", "nord", "cnor", "csud", "sud", "sici", "sard"], default: "nazionale" },
      { name: "date", in: "query", type: "string", required: false, description: "Giorno di mercato (YYYY-MM-DD). In alternativa usare from/to (max 31 giorni).", example: "2026-09-27" },
      { name: "from", in: "query", type: "string", required: false, description: "Data iniziale (YYYY-MM-DD)." },
      { name: "to", in: "query", type: "string", required: false, description: "Data finale (YYYY-MM-DD)." },
    ],
    exampleCall: "/pun/hourly?zone=nord&date=2026-09-27",
    response: {
      zone: "nord",
      date: "2026-09-27",
      unit: "€/MWh",
      timezone: "Europe/Rome",
      hours: [
        { hour: 1, starts_at: "2026-09-27T00:00:00+02:00", value: 104.1, band: "F3" },
        { hour: 2, starts_at: "2026-09-27T01:00:00+02:00", value: 98.62, band: "F3" },
        { hour: 14, starts_at: "2026-09-27T13:00:00+02:00", value: 71.3, band: "F3" },
        { hour: 20, starts_at: "2026-09-27T19:00:00+02:00", value: 168.45, band: "F3" },
      ],
      cheapest_hours: [13, 14, 15],
      stats: { min: 71.3, max: 168.45, avg: 117.95 },
    },
    fields: [
      { name: "hours[].hour", type: "integer", description: "Ora di mercato 1–24 (1–23 o 1–25 nei cambi d'ora)." },
      { name: "hours[].starts_at", type: "string (ISO 8601)", description: "Inizio dell'ora con offset Europe/Rome." },
      { name: "hours[].value", type: "number", description: "Prezzo orario (€/MWh)." },
      { name: "hours[].band", type: "string", description: "Fascia ARERA: F1, F2 o F3." },
      { name: "cheapest_hours", type: "integer[]", description: "Le tre ore meno care del giorno." },
    ],
    formats: ["json", "csv"],
    cache: "1 ora",
  },

  // ---------------------------------------------------------- INDICI
  {
    id: "energy-index",
    method: "GET",
    path: "/energy-index",
    title: "Energy Index delle offerte",
    summary: "Media, mediana e range delle offerte luce e gas del mercato libero.",
    description:
      "I quattro indici proprietari Energy Index (Fisse Luce, Variabili Luce, Fisse Gas, Variabili Gas) calcolati sulle offerte pubblicate sul Portale Offerte ARERA. Aggregati di mercato: nessun dato di singolo fornitore.",
    category: "indici",
    tier: "open",
    status: "coming",
    params: [
      { name: "commodity", in: "query", type: "string", required: false, description: "Filtra per commodity.", enum: ["luce", "gas"] },
    ],
    exampleCall: "/energy-index?commodity=luce",
    response: {
      updated_at: "2026-09-26",
      indices: [
        { slug: "mercato-libero-luce-fissa", name: "Energy Index · Fisse Luce", unit: "€/kWh", mean: 0.1342, median: 0.129, min: 0.0989, max: 0.1995, offers: 212 },
        { slug: "mercato-libero-luce-variabile", name: "Energy Index · Variabili Luce", unit: "€/kWh", mean: 0.1407, median: 0.1376, min: 0.1201, max: 0.1788, offers: 248, spread_vs_reference: 0.0219 },
      ],
      source: "ARERA — Portale Offerte",
      attribution: ATTR,
    },
    fields: [
      { name: "indices[].slug", type: "string", description: "Identificativo stabile dell'indice." },
      { name: "indices[].mean / median", type: "number", description: "Media e mediana del prezzo materia prima delle offerte attive." },
      { name: "indices[].min / max", type: "number", description: "Estremi del range di mercato." },
      { name: "indices[].offers", type: "integer", description: "Numero di offerte considerate." },
      { name: "indices[].spread_vs_reference", type: "number?", description: "Solo variabili: spread medio sopra PUN o PSV." },
    ],
    formats: ["json"],
    cache: "6 ore",
  },
  {
    id: "mercato-libero-stats",
    method: "GET",
    path: "/mercato-libero/stats",
    title: "Statistiche mercato libero",
    summary: "Distribuzione delle offerte, costi fissi e spread per zona e tipologia.",
    description:
      "Statistiche dettagliate sulle offerte attive del mercato libero: percentili di prezzo, quota fissa mensile, spread applicati sopra PUN/PSV e distribuzione per tipologia di cliente. Base per benchmark di listino e analisi competitive.",
    category: "indici",
    tier: "api",
    status: "coming",
    params: [
      { name: "commodity", in: "query", type: "string", required: true, description: "Commodity.", enum: ["luce", "gas"], example: "luce" },
      { name: "price_type", in: "query", type: "string", required: false, description: "Tipologia di prezzo.", enum: ["fisso", "variabile"] },
      { name: "customer", in: "query", type: "string", required: false, description: "Tipologia di cliente.", enum: ["domestico", "business"], default: "domestico" },
    ],
    exampleCall: "/mercato-libero/stats?commodity=luce&price_type=variabile",
    response: {
      commodity: "luce",
      price_type: "variabile",
      offers: 248,
      spread_eur_kwh: { p10: 0.008, p25: 0.012, median: 0.0165, p75: 0.022, p90: 0.031 },
      fixed_cost_eur_month: { p10: 6.5, median: 10.9, p90: 16 },
      updated_at: "2026-09-26",
    },
    fields: [
      { name: "spread_eur_kwh", type: "object", description: "Percentili dello spread sopra il PUN (€/kWh)." },
      { name: "fixed_cost_eur_month", type: "object", description: "Percentili della quota fissa di commercializzazione (€/mese)." },
    ],
    formats: ["json", "csv"],
    cache: "6 ore",
  },

  // ---------------------------------------------------------- FORECAST
  {
    id: "forecast-next",
    method: "GET",
    path: "/forecast/{asset}/next",
    title: "Forecast del giorno dopo",
    summary: "La previsione puntuale di domani per PUN, PSV o TTF.",
    description:
      "Il valore previsto da EIDX Research per il prossimo giorno di mercato, con l'errore medio del modello negli ultimi 30 giorni per valutarne l'affidabilita'.",
    category: "forecast",
    tier: "developer",
    status: "coming",
    params: [
      { name: "asset", in: "path", type: "string", required: true, description: "Indice.", enum: ["pun", "psv", "ttf"], example: "pun" },
    ],
    exampleCall: "/forecast/pun/next",
    response: {
      asset: "PUN",
      target_date: "2026-09-28",
      value: 114.6,
      unit: "€/MWh",
      model: "eidx-ensemble-v3",
      mape_30d: 0.071,
      generated_at: "2026-09-27T06:00:00Z",
      methodology: "https://energyindex.it/it/forecast/metodologia",
    },
    fields: [
      { name: "target_date", type: "string", description: "Giorno a cui si riferisce la previsione." },
      { name: "value", type: "number", description: "Valore previsto." },
      { name: "mape_30d", type: "number", description: "Errore percentuale medio assoluto degli ultimi 30 giorni (0,071 = 7,1%)." },
    ],
    formats: ["json"],
    cache: "1 ora",
  },
  {
    id: "forecast",
    method: "GET",
    path: "/forecast/{asset}",
    title: "Forecast con bande di confidenza",
    summary: "Curva prevista a 7, 30, 90 o 180 giorni con P10/P50/P90.",
    description:
      "La curva di previsione completa, un punto al giorno, con banda di confidenza P10–P90. Stesso modello del forecast pubblico, con storico delle previsioni passate verificabile via /forecast/track-record.",
    category: "forecast",
    tier: "api",
    status: "coming",
    params: [
      { name: "asset", in: "path", type: "string", required: true, description: "Indice.", enum: ["pun", "psv", "ttf"], example: "pun" },
      { name: "horizon", in: "query", type: "integer", required: false, description: "Orizzonte in giorni.", enum: ["7", "30", "90", "180"], default: 30 },
    ],
    exampleCall: "/forecast/pun?horizon=30",
    response: {
      asset: "PUN",
      unit: "€/MWh",
      horizon_days: 30,
      generated_at: "2026-09-27T06:00:00Z",
      points: [
        { date: "2026-09-28", p10: 104.2, p50: 114.6, p90: 126.1 },
        { date: "2026-09-29", p10: 105.8, p50: 117.2, p90: 130.4 },
        { date: "2026-10-27", p10: 98.4, p50: 121.9, p90: 149.7 },
      ],
      summary: { avg_p50: 119.3, trend: "up" },
    },
    fields: [
      { name: "points[].p50", type: "number", description: "Valore centrale previsto (mediana)." },
      { name: "points[].p10 / p90", type: "number", description: "Estremi della banda di confidenza all'80%." },
      { name: "summary.trend", type: "string", description: "up, down o flat rispetto all'ultimo valore osservato." },
    ],
    formats: ["json", "csv"],
    cache: "1 ora",
  },
  {
    id: "forecast-scenarios",
    method: "GET",
    path: "/forecast/{asset}/scenarios",
    title: "Forecast 12 mesi a scenari",
    summary: "Base, rialzo e ribasso mese per mese sui prossimi 12 mesi.",
    description:
      "Proiezione mensile a 12 mesi in tre scenari, con le ipotesi su gas, CO2 e domanda che li guidano. E' la base del modulo Forecast Scenari di EIDX Pro.",
    category: "forecast",
    tier: "pro",
    status: "coming",
    params: [
      { name: "asset", in: "path", type: "string", required: true, description: "Indice.", enum: ["pun", "psv"], example: "pun" },
      { name: "months", in: "query", type: "integer", required: false, description: "Numero di mesi (1–12, 24 per Enterprise).", default: 12 },
    ],
    exampleCall: "/forecast/pun/scenarios?months=12",
    response: {
      asset: "PUN",
      unit: "€/MWh",
      months: [
        { month: "2026-10", base: 118.4, bull: 134.9, bear: 101.2 },
        { month: "2026-11", base: 124.7, bull: 146.3, bear: 104.8 },
      ],
      assumptions: { ttf_base: 35.5, co2_base: 70.2 },
    },
    fields: [
      { name: "months[].base / bull / bear", type: "number", description: "Prezzo medio mensile nei tre scenari." },
      { name: "assumptions", type: "object", description: "Ipotesi di input dello scenario base." },
    ],
    formats: ["json", "csv"],
    cache: "6 ore",
  },

  // ---------------------------------------------------------- TOOLS
  {
    id: "bill-estimate",
    method: "GET",
    path: "/tools/bill-estimate",
    title: "Stima spesa bolletta",
    summary: "Quanto costa la materia prima dato un consumo annuo.",
    description:
      "Stima la spesa annua e mensile per la sola materia energia su un consumo dato, con PUN o PSV attuale piu' lo spread medio del mercato libero. Utile per blog, siti di consumatori e calcolatori embeddati. Non include oneri di sistema, trasporto e imposte, che vengono indicati a parte come ordine di grandezza.",
    category: "tools",
    tier: "open",
    status: "coming",
    params: [
      { name: "commodity", in: "query", type: "string", required: true, description: "Commodity.", enum: ["luce", "gas"], example: "luce" },
      { name: "consumption", in: "query", type: "number", required: true, description: "Consumo annuo in kWh (luce) o Smc (gas).", example: 2700 },
      { name: "price_type", in: "query", type: "string", required: false, description: "Offerta a prezzo fisso (Energy Index mediano) o variabile (indice + spread).", enum: ["fisso", "variabile"], default: "variabile" },
    ],
    exampleCall: "/tools/bill-estimate?commodity=luce&consumption=2700",
    response: {
      commodity: "luce",
      consumption: 2700,
      consumption_unit: "kWh/anno",
      energy_price_eur_kwh: 0.13523,
      energy_cost_year_eur: 365.12,
      energy_cost_month_eur: 30.43,
      basis: "PUN ultimo mese + spread mediano mercato libero",
      compare_offers: "https://energiapro.biz",
      attribution: ATTR,
    },
    fields: [
      { name: "energy_price_eur_kwh", type: "number", description: "Prezzo della materia prima usato per la stima." },
      { name: "energy_cost_year_eur / month_eur", type: "number", description: "Spesa materia prima annua e mensile." },
      { name: "basis", type: "string", description: "Base di calcolo, da mostrare all'utente." },
    ],
    formats: ["json"],
    cache: "6 ore",
  },
  {
    id: "margin-simulator",
    method: "POST",
    path: "/tools/margin-simulator",
    title: "Margin Simulator",
    summary: "Margine atteso di un listino indicizzato su un portafoglio clienti.",
    description:
      "Simula il margine di un'offerta (spread e quota fissa) su un portafoglio di clienti, con i prezzi forward e gli scenari di stress di EIDX Pro. Stessa logica del modulo Margin Simulator.",
    category: "tools",
    tier: "pro",
    status: "coming",
    params: [
      { name: "commodity", in: "body", type: "string", required: true, description: "luce o gas.", enum: ["luce", "gas"] },
      { name: "spread_eur_kwh", in: "body", type: "number", required: true, description: "Spread applicato sopra l'indice." },
      { name: "fixed_fee_eur_month", in: "body", type: "number", required: true, description: "Quota fissa mensile." },
      { name: "portfolio", in: "body", type: "object", required: true, description: "Clienti e consumo annuo medio." },
      { name: "months", in: "body", type: "integer", required: false, description: "Orizzonte in mesi.", default: 12 },
    ],
    exampleCall: "/tools/margin-simulator",
    exampleBody: {
      commodity: "luce",
      spread_eur_kwh: 0.015,
      fixed_fee_eur_month: 9.9,
      portfolio: { customers: 1200, avg_consumption_kwh: 2700 },
      months: 12,
    },
    response: {
      gross_margin_eur: { base: 162840, stress_up: 128400, stress_down: 171200 },
      margin_per_customer_eur_year: 135.7,
      breakeven_spread_eur_kwh: 0.0068,
    },
    fields: [
      { name: "gross_margin_eur", type: "object", description: "Margine lordo totale nello scenario base e nei due stress." },
      { name: "breakeven_spread_eur_kwh", type: "number", description: "Spread minimo per coprire i costi." },
    ],
    formats: ["json"],
    cache: "Nessuna (calcolo on demand)",
  },

  // ---------------------------------------------------------- TRADING
  {
    id: "trading-vitals",
    method: "GET",
    path: "/trading/vitals",
    title: "Trading Vitals",
    summary: "Spark Spread, Clean Spark Spread, ATR e cross spread.",
    description:
      "Gli indicatori del Trading Desk EIDX Pro: spark spread e clean spark spread (PUN vs gas + CO2), volatilita' ATR a 14 giorni, spread PSV–TTF.",
    category: "trading",
    tier: "trading",
    status: "coming",
    params: [
      { name: "date", in: "query", type: "string", required: false, description: "Giorno (YYYY-MM-DD). Default: ultimo." },
    ],
    exampleCall: "/trading/vitals",
    response: {
      date: "2026-09-26",
      spark_spread: 47.2,
      clean_spark_spread: 22.1,
      psv_ttf_spread: 3.91,
      atr_14d: { pun: 9.84, psv: 1.72 },
      unit: "€/MWh",
    },
    fields: [
      { name: "clean_spark_spread", type: "number", description: "Margine teorico di un CCGT al netto di gas e CO2." },
      { name: "atr_14d", type: "object", description: "Average True Range a 14 giorni per indice." },
    ],
    formats: ["json", "csv"],
    cache: "15 minuti",
  },
  {
    id: "trading-correlation",
    method: "GET",
    path: "/trading/correlation",
    title: "Matrice di correlazione",
    summary: "Correlazioni rolling tra PUN, PSV, TTF, Brent e CO2.",
    description: "Matrice di correlazione di Pearson sui rendimenti giornalieri, su finestra mobile configurabile.",
    category: "trading",
    tier: "trading",
    status: "coming",
    params: [
      { name: "window", in: "query", type: "integer", required: false, description: "Finestra in giorni.", enum: ["30", "90", "180"], default: 30 },
    ],
    exampleCall: "/trading/correlation?window=30",
    response: {
      window_days: 30,
      assets: ["PUN", "PSV", "TTF"],
      matrix: [
        [1, 0.82, 0.79],
        [0.82, 1, 0.94],
        [0.79, 0.94, 1],
      ],
    },
    fields: [
      { name: "assets", type: "string[]", description: "Ordine di righe e colonne." },
      { name: "matrix", type: "number[][]", description: "Coefficienti di correlazione da −1 a 1." },
    ],
    formats: ["json"],
    cache: "1 ora",
  },
  {
    id: "trading-backtest",
    method: "POST",
    path: "/trading/backtest",
    title: "Backtest di strategie",
    summary: "Esegue una strategia di copertura o trading sullo storico.",
    description:
      "Backtest di strategie predefinite (media mobile, soglia, copertura a finestra) su PUN, PSV o TTF, con P&L, drawdown e confronto con buy & hold.",
    category: "trading",
    tier: "trading",
    status: "coming",
    params: [
      { name: "asset", in: "body", type: "string", required: true, description: "Indice.", enum: ["pun", "psv", "ttf"] },
      { name: "strategy", in: "body", type: "string", required: true, description: "Strategia.", enum: ["sma_cross", "threshold", "rolling_hedge"] },
      { name: "from", in: "body", type: "string", required: true, description: "Data iniziale del backtest (YYYY-MM-DD)." },
      { name: "to", in: "body", type: "string", required: true, description: "Data finale del backtest (YYYY-MM-DD)." },
      { name: "params", in: "body", type: "object", required: false, description: "Parametri della strategia." },
    ],
    exampleCall: "/trading/backtest",
    exampleBody: { asset: "pun", strategy: "sma_cross", from: "2024-01-01", to: "2026-09-26", params: { fast: 10, slow: 30 } },
    response: {
      total_return_pct: 18.4,
      max_drawdown_pct: -7.9,
      sharpe: 1.21,
      trades: 37,
      benchmark_return_pct: 4.2,
    },
    fields: [
      { name: "sharpe", type: "number", description: "Sharpe ratio annualizzato." },
      { name: "benchmark_return_pct", type: "number", description: "Rendimento buy & hold sullo stesso periodo." },
    ],
    formats: ["json"],
    cache: "Nessuna (calcolo on demand)",
  },

  // ---------------------------------------------------------- AUTOMAZIONE
  {
    id: "alerts-create",
    method: "POST",
    path: "/alerts",
    title: "Crea un alert webhook",
    summary: "Ricevi una chiamata HTTP quando un indice supera una soglia.",
    description:
      "Registra un alert: quando l'indice pubblicato attraversa la soglia, Energy Index invia una POST firmata al tuo URL (Slack, Teams, Telegram, Zapier, Make, n8n o il tuo backend). Ogni alert scatta al massimo una volta per giorno di mercato.",
    category: "automazione",
    tier: "api",
    status: "coming",
    params: [
      { name: "asset", in: "body", type: "string", required: true, description: "Indice monitorato.", enum: ["pun", "psv", "ttf", "pun-zona-nord", "pun-zona-sud"] },
      { name: "condition", in: "body", type: "string", required: true, description: "Condizione.", enum: ["above", "below", "change_pct"] },
      { name: "threshold", in: "body", type: "number", required: true, description: "Soglia in €/MWh, o variazione % per change_pct." },
      { name: "webhook_url", in: "body", type: "string", required: true, description: "URL HTTPS che ricevera' la notifica." },
    ],
    exampleCall: "/alerts",
    exampleBody: { asset: "psv", condition: "above", threshold: 45, webhook_url: "https://hooks.slack.com/services/T000/B000/XXXX" },
    response: {
      id: "alr_8Kq2mZ",
      asset: "psv",
      condition: "above",
      threshold: 45,
      status: "active",
      signing_secret: "whsec_•••• (mostrato una sola volta)",
      created_at: "2026-09-27T08:12:44Z",
    },
    fields: [
      { name: "id", type: "string", description: "Identificativo dell'alert, usato per DELETE /alerts/{id}." },
      { name: "signing_secret", type: "string", description: "Segreto per verificare l'header X-EIDX-Signature (HMAC-SHA256)." },
    ],
    formats: ["json"],
    cache: "Nessuna",
  },
  {
    id: "bulk-export",
    method: "GET",
    path: "/bulk/{dataset}",
    title: "Export bulk",
    summary: "Dataset completi in CSV compresso o Parquet.",
    description:
      "Scarica l'intero storico di un dataset in un solo file, rigenerato ogni notte. Per data warehouse, modelli interni e analisi offline.",
    category: "automazione",
    tier: "enterprise",
    status: "coming",
    params: [
      { name: "dataset", in: "path", type: "string", required: true, description: "Dataset.", enum: ["pun-hourly", "prices-daily", "forecast-history", "mercato-libero"], example: "pun-hourly" },
      { name: "format", in: "query", type: "string", required: false, description: "Formato.", enum: ["csv.gz", "parquet"], default: "parquet" },
    ],
    exampleCall: "/bulk/pun-hourly?format=parquet",
    response: {
      dataset: "pun-hourly",
      format: "parquet",
      rows: 1843200,
      generated_at: "2026-09-27T02:00:00Z",
      download_url: "https://energyindex.it/api/v1/bulk/files/pun-hourly-20260927.parquet?sig=…",
      expires_at: "2026-09-27T03:00:00Z",
    },
    fields: [
      { name: "download_url", type: "string", description: "URL firmato, valido un'ora." },
      { name: "rows", type: "integer", description: "Righe del dataset." },
    ],
    formats: ["json"],
    cache: "Rigenerato ogni notte",
  },
];

export function endpointsByCategory(cat: CategoryId): ApiEndpoint[] {
  return ENDPOINTS.filter((e) => e.category === cat);
}

// ============================================================
// SNIPPET DI CODICE
// ============================================================

export type SnippetLang = "curl" | "javascript" | "python" | "sheets";

function needsKey(e: ApiEndpoint): boolean {
  return e.tier !== "open";
}

export function buildSnippet(e: ApiEndpoint, lang: SnippetLang): string {
  const url = `${API_BASE_URL}${e.exampleCall}`;
  const key = needsKey(e);
  const body = e.exampleBody ? JSON.stringify(e.exampleBody, null, 2) : null;

  switch (lang) {
    case "curl": {
      const lines = [`curl${e.method !== "GET" ? ` -X ${e.method}` : ""} "${url}"`];
      if (key) lines.push(`  -H "Authorization: Bearer $EIDX_API_KEY"`);
      if (body) {
        lines.push(`  -H "Content-Type: application/json"`);
        lines.push(`  -d '${JSON.stringify(e.exampleBody)}'`);
      }
      return lines.join(" \\\n");
    }
    case "javascript": {
      const opts: string[] = [];
      if (e.method !== "GET") opts.push(`  method: "${e.method}",`);
      const headers: string[] = [];
      if (key) headers.push(`    Authorization: \`Bearer \${process.env.EIDX_API_KEY}\`,`);
      if (body) headers.push(`    "Content-Type": "application/json",`);
      if (headers.length) opts.push(`  headers: {\n${headers.join("\n")}\n  },`);
      if (body) opts.push(`  body: JSON.stringify(${body.replace(/\n/g, "\n  ")}),`);
      const init = opts.length ? `, {\n${opts.join("\n")}\n}` : "";
      return `const res = await fetch("${url}"${init});\nconst data = await res.json();\nconsole.log(data);`;
    }
    case "python": {
      const lines = ["import os, requests", ""];
      const args: string[] = [`"${url}"`];
      if (key) args.push(`headers={"Authorization": f"Bearer {os.environ['EIDX_API_KEY']}"}`);
      if (body) args.push(`json=${JSON.stringify(e.exampleBody)}`);
      const fn = e.method === "GET" ? "get" : e.method.toLowerCase();
      lines.push(`res = requests.${fn}(\n    ${args.join(",\n    ")},\n    timeout=10,\n)`);
      lines.push("res.raise_for_status()");
      lines.push("print(res.json())");
      return lines.join("\n");
    }
    case "sheets": {
      if (e.formats.includes("csv")) {
        const sep = e.exampleCall.includes("?") ? "&" : "?";
        const k = key ? "&key=LA_TUA_CHIAVE" : "";
        return `=IMPORTDATA("${url}${sep}format=csv${k}")`;
      }
      return `// Apps Script (Estensioni → Apps Script)\nfunction EIDX(path) {\n  const res = UrlFetchApp.fetch("${API_BASE_URL}" + path);\n  const data = JSON.parse(res.getContentText());\n  return data.value_native ?? data.value;\n}\n\n// In una cella:  =EIDX("/pun/today")`;
    }
  }
}

export const SNIPPET_LABELS: Record<SnippetLang, string> = {
  curl: "cURL",
  javascript: "JavaScript",
  python: "Python",
  sheets: "Google Sheets",
};
