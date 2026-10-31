# Widget embeddabile e chiavi API legate al dominio — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ogni uso delle API di Energy Index deve portare un link di marca visibile e un dominio tracciato. Per farlo servono quattro pezzi: un widget che si disattiva da solo se manca l'attribuzione, chiavi Developer self-service legate a un dominio con verifica settimanale del link, quote applicate davvero e una vista admin delle integrazioni.

**Architecture:** La logica sta in moduli TypeScript puri, testati con vitest:
- `lib/api-keys/*` per chiavi, controllo dell'Origin, decisione di accesso e parser dei link;
- `lib/widget/*` per verifica dell'attribuzione, snippet e formattazione;
- `lib/api/energy-index.ts` per il serializer.

Il middleware esistente (`middleware.ts`, ramo `/api/v1`) legge chiave e lista "throttled" da PostgREST, con una cache in memoria di 60 s. Le quote si calcolano in modo asincrono da `traffic_log`, con una RPC lanciata da pg_cron ogni 5 minuti. Il widget è un bundle esbuild generato in `public/widget.js` al prebuild. La verifica dei link è uno script `tsx` lanciato da una GitHub Action settimanale.

**Tech Stack:** Next.js 16 (App Router; `middleware.ts` è deprecato a favore di `proxy.ts`, ma lo lasciamo com'è: la migrazione è fuori scope), TypeScript strict, Supabase Postgres (RLS, RPC SECURITY DEFINER, pg_cron), Resend, esbuild, Vitest (+ jsdom), GitHub Actions, Netlify.

**Design di riferimento:** `docs/plans/2026-10-31-widget-chiavi-dominio-design.md`. Leggilo prima di iniziare.

---

## Contesto per chi non c'era

- **Next.js 16 ha API diverse da quelle note.** Prima di scrivere una route o una pagina leggi `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` e `page.md`. `params` e `searchParams` sono `Promise`.
- **Migrazioni.** Si applicano con il Supabase MCP (`apply_migration`), non con la CLI: il workflow `deploy-db.yml` è disattivato perché i file e il DB sono disallineati. Se l'MCP risponde "permission denied", chiedi al titolare di applicare il file SQL dall'SQL Editor di Supabase e non aggirare il blocco.
- **DB locale = DB di produzione.** `.env.local` punta al DB di produzione. Niente scritture di massa di prova. `writeRecord` non scrive log dal dev server (`NODE_ENV=development`).
- **Tabelle admin.** `traffic_log` e `leads` sono definite in `supabase/migrations/20260927000001_admin_traffic_leads.sql`. `traffic_log.api_key_prefix` contiene i primi 14 caratteri della chiave (`lib/traffic/log.ts: apiKeyPrefix`), quindi `eidx_live_` più 4 caratteri.
- **Pattern del log.** Il middleware non usa supabase-js: fa fetch a PostgREST con la service role (`lib/traffic/log.ts: writeRecord`). Va seguito lo stesso schema, perché il middleware gira su edge.
- **Email.** Resend, come in `app/actions/request-api-key.ts` (`RESEND_API_KEY`, `RESEND_SENDER_EMAIL`, fallback mailto).
- **Licenza GME.** Le varianti `pun` e `psv` del widget devono riportare nell'HTML statico la riga "Fonte: Gestore dei Mercati Energetici S.p.A. — via Energy Index" (dicitura richiesta dalle condizioni GME, uguale al campo `attribution` delle API; mai "Dati: ...") (vedi la memoria `gme-licenza-dati`).
- **Commit.** Ogni commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Tutte le stringhe visibili all'utente sono in italiano.
- **Test.** `npx vitest run` (353 test verdi prima di iniziare), `npx tsc --noEmit -p .`, `npx eslint <file>`.

---

## Task 0: Branch e baseline

**Step 1:** Crea il branch.

```bash
git checkout -b feat/widget-chiavi-dominio
```

**Step 2:** Verifica la baseline.

Run: `npx vitest run 2>&1 | tail -4 && npx tsc --noEmit -p .`
Expected: `Tests 353 passed`, nessun errore tsc.

---

## Task 1: Serializer `/energy-index`

**Files:**
- Create: `lib/api/energy-index.ts`
- Test: `tests/lib/energy-index-json.test.ts`

**Step 1: Scrivi il test che fallisce**

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { buildEnergyIndexJson, latestPerSlug } from "@/lib/api/energy-index";

const rows = [
  { aggregate_slug: "mercato-libero-luce-fissa", computed_at: "2026-10-30", median: "0.129", p25: "0.115", p75: "0.141", min: "0.0989", max: "0.1995", sample_size: 212, spread_vs_reference_pct: null, unit: "€/kWh" },
  { aggregate_slug: "mercato-libero-luce-fissa", computed_at: "2026-10-29", median: "0.130", p25: null, p75: null, min: "0.1", max: "0.2", sample_size: 210, spread_vs_reference_pct: null, unit: "€/kWh" },
  { aggregate_slug: "mercato-libero-gas-variabile", computed_at: "2026-10-30", median: "0.52", p25: "0.49", p75: "0.56", min: "0.4", max: "0.7", sample_size: 180, spread_vs_reference_pct: "18.4", unit: "€/Smc" },
];

describe("latestPerSlug", () => {
  it("tiene solo lo snapshot piu' recente di ogni indice", () => {
    const latest = latestPerSlug(rows);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.aggregate_slug === "mercato-libero-luce-fissa")?.computed_at).toBe("2026-10-30");
  });
});

describe("buildEnergyIndexJson", () => {
  it("converte i numeric in numeri e usa i nomi Energy Index", () => {
    const j = buildEnergyIndexJson(latestPerSlug(rows));
    const luce = j.indices.find((i) => i.slug === "mercato-libero-luce-fissa")!;
    expect(luce).toMatchObject({ name: "Energy Index · Luce — Prezzo Fisso", median: 0.129, p25: 0.115, offers: 212, date: "2026-10-30" });
    expect(luce.spread_vs_reference_pct).toBeUndefined();
  });

  it("include lo spread solo per le variabili", () => {
    const j = buildEnergyIndexJson(latestPerSlug(rows));
    expect(j.indices.find((i) => i.slug === "mercato-libero-gas-variabile")!.spread_vs_reference_pct).toBe(18.4);
  });

  it("filtra per commodity", () => {
    const j = buildEnergyIndexJson(latestPerSlug(rows), "gas");
    expect(j.indices.map((i) => i.slug)).toEqual(["mercato-libero-gas-variabile"]);
  });

  it("attribuzione Energy Index con fonte ARERA, data = snapshot piu' recente", () => {
    const j = buildEnergyIndexJson(latestPerSlug(rows));
    expect(j.attribution).toContain("Energy Index");
    expect(j.attribution).toContain("ARERA");
    expect(j.updated_at).toBe("2026-10-30");
  });
});
```

**Step 2:** Verifica che fallisca.

Run: `npx vitest run tests/lib/energy-index-json.test.ts`
Expected: FAIL, `Cannot find module '@/lib/api/energy-index'`.

**Step 3: Implementazione minima**

```ts
/**
 * Serializzazione pura di /api/v1/energy-index: ultimo snapshot dei 4
 * indici proprietari (energy_index_aggregates), calcolati sulle offerte
 * del Portale Offerte ARERA. Sono elaborazioni Energy Index, quindi
 * riusabili con attribuzione (a differenza dei dati GME).
 */

import { AGGREGATE_SLUGS } from "@/lib/arera-aggregates";

export interface AggregateRow {
  aggregate_slug: string;
  computed_at: string;
  median: number | string;
  p25: number | string | null;
  p75: number | string | null;
  min: number | string;
  max: number | string;
  sample_size: number;
  spread_vs_reference_pct: number | string | null;
  unit: string;
}

export interface EnergyIndexItem {
  slug: string;
  name: string;
  commodity: "luce" | "gas";
  price_type: "fisso" | "variabile";
  unit: string;
  date: string;
  median: number;
  p25: number | null;
  p75: number | null;
  min: number;
  max: number;
  offers: number;
  spread_vs_reference_pct?: number;
  page: string;
}

export interface EnergyIndexJson {
  updated_at: string | null;
  indices: EnergyIndexItem[];
  source: string;
  attribution: string;
  page: string;
}

export const ENERGY_INDEX_ATTRIBUTION =
  "Fonte: Energy Index (https://energyindex.it) — elaborazione su dati Portale Offerte ARERA";

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

export function latestPerSlug(rows: AggregateRow[]): AggregateRow[] {
  const best = new Map<string, AggregateRow>();
  for (const r of rows) {
    const cur = best.get(r.aggregate_slug);
    if (!cur || r.computed_at > cur.computed_at) best.set(r.aggregate_slug, r);
  }
  return [...best.values()];
}

export function buildEnergyIndexJson(rows: AggregateRow[], commodity?: "luce" | "gas"): EnergyIndexJson {
  const indices: EnergyIndexItem[] = [];
  for (const def of AGGREGATE_SLUGS) {
    const r = rows.find((x) => x.aggregate_slug === def.slug);
    if (!r) continue;
    const c = def.commodity === "electricity" ? "luce" : "gas";
    if (commodity && c !== commodity) continue;
    const item: EnergyIndexItem = {
      slug: def.slug,
      name: `Energy Index · ${def.displayName}`,
      commodity: c,
      price_type: def.priceType,
      unit: r.unit,
      date: r.computed_at,
      median: Number(r.median),
      p25: num(r.p25),
      p75: num(r.p75),
      min: Number(r.min),
      max: Number(r.max),
      offers: r.sample_size,
      page: "https://energyindex.it/it/mercato-libero",
    };
    if (def.priceType === "variabile" && r.spread_vs_reference_pct !== null) {
      item.spread_vs_reference_pct = Number(r.spread_vs_reference_pct);
    }
    indices.push(item);
  }
  const updated = indices.reduce<string | null>((m, i) => (m && m > i.date ? m : i.date), null);
  return {
    updated_at: updated,
    indices,
    source: "ARERA — Portale Offerte",
    attribution: ENERGY_INDEX_ATTRIBUTION,
    page: "https://energyindex.it/it/mercato-libero",
  };
}
```

Se `displayName` in `lib/arera-aggregates.ts` non è "Luce — Prezzo Fisso", adatta l'atteso del test al valore reale; non cambiare `displayName`.

**Step 4:** Run: `npx vitest run tests/lib/energy-index-json.test.ts`. Expected: PASS (5 test).

**Step 5: Commit**

```bash
git add lib/api/energy-index.ts tests/lib/energy-index-json.test.ts
git commit -m "feat(api): serializer puro per /energy-index"
```

---

## Task 2: Route `/api/v1/energy-index` e catalogo

**Files:**
- Create: `app/api/v1/energy-index/route.ts`
- Modify: `lib/api/catalog.ts` (voce `id: "energy-index"`: `status: "live"`, `response` e `fields` riallineati a `EnergyIndexJson`)

**Step 1: Route** (stesso schema di `app/api/v1/pun/today/route.ts`)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiHeaders } from "@/lib/api/latest-price";
import { buildEnergyIndexJson, latestPerSlug, type AggregateRow } from "@/lib/api/energy-index";

/**
 * GET /api/v1/energy-index[?commodity=luce|gas]
 *
 * Ultimo snapshot dei 4 Energy Index delle offerte. Cache 6 ore: gli
 * aggregati si ricalcolano una volta al giorno.
 */
export const revalidate = 21600;

const headers = { ...apiHeaders, "Cache-Control": "public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400" };

export async function GET(request: NextRequest) {
  const c = request.nextUrl.searchParams.get("commodity");
  if (c !== null && c !== "luce" && c !== "gas") {
    return NextResponse.json(
      { error: "invalid_param", message: "commodity deve essere 'luce' o 'gas'." },
      { status: 400, headers },
    );
  }
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("energy_index_aggregates")
    .select("aggregate_slug, computed_at, median, p25, p75, min, max, sample_size, spread_vs_reference_pct, unit")
    .order("computed_at", { ascending: false })
    .limit(40);
  const json = buildEnergyIndexJson(latestPerSlug((data ?? []) as AggregateRow[]), c ?? undefined);
  if (json.indices.length === 0) {
    return NextResponse.json(
      { error: "no_data", message: "Nessun Energy Index disponibile.", attribution: json.attribution },
      { status: 503, headers },
    );
  }
  return NextResponse.json(json, { status: 200, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
```

**Step 2: Catalogo.** Nella voce `energy-index` di `lib/api/catalog.ts`:
- `status: "live"`;
- `response`: un esempio con la forma `EnergyIndexJson`, 2 indici, campi `median/p25/p75/min/max/offers/date/page`, senza `mean`;
- `fields`: un campo per `updated_at`, `indices[].median / p25 / p75`, `indices[].min / max`, `indices[].offers`, `indices[].spread_vs_reference_pct` (solo per le variabili, in %), `attribution`.

**Step 3: Verifica locale**

```bash
npx tsc --noEmit -p .
```

Poi avvia il dev server con `preview_start {name: "dev"}` e lancia:

```bash
curl -s "http://localhost:<porta>/api/v1/energy-index?commodity=luce" | python3 -m json.tool
```

Expected: 2 indici luce con valori numerici. Con `?commodity=x` la risposta è un 400.

**Step 4:** Run: `npx vitest run`. Expected: tutti verdi (il catalogo non ha test che vincolano `status`; se un test controlla gli endpoint live, aggiornalo).

**Step 5: Commit**

```bash
git add app/api/v1/energy-index/route.ts lib/api/catalog.ts
git commit -m "feat(api): /energy-index live con contratto allineato allo schema"
```

---

## Task 3: Primitive delle chiavi (edge-safe)

**Files:**
- Create: `lib/api-keys/keys.ts`
- Test: `tests/lib/api-keys.test.ts`

Il modulo gira nel middleware (edge), quindi niente `node:crypto`: solo `crypto.getRandomValues` e `crypto.subtle`.

**Step 1: Test che fallisce**

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { generateApiKey, sha256Hex, keyDisplayPrefix, normalizeDomain, originAllowed, KEY_PREFIX } from "@/lib/api-keys/keys";

describe("generateApiKey", () => {
  it("formato eidx_live_ + 32 caratteri base62", () => {
    const k = generateApiKey();
    expect(k.startsWith(KEY_PREFIX)).toBe(true);
    expect(k.slice(KEY_PREFIX.length)).toMatch(/^[0-9A-Za-z]{32}$/);
  });
  it("chiavi diverse a ogni chiamata", () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });
});

describe("sha256Hex", () => {
  it("hash noto", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("keyDisplayPrefix", () => {
  it("14 caratteri, come api_key_prefix in traffic_log", () => {
    expect(keyDisplayPrefix("eidx_live_AbCdEfGh")).toBe("eidx_live_AbCd");
  });
});

describe("normalizeDomain", () => {
  it.each([
    ["https://www.Esempio.it/pagina?x=1", "esempio.it"],
    ["esempio.it", "esempio.it"],
    ["blog.esempio.it", "blog.esempio.it"],
    ["  WWW.esempio.it/  ", "esempio.it"],
  ])("%s → %s", (input, out) => {
    expect(normalizeDomain(input)).toBe(out);
  });
  it.each(["", "localhost", "non un dominio", "http://", "192.168.1.1"])("rifiuta %s", (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});

describe("originAllowed", () => {
  it("dominio esatto, www e sottodomini", () => {
    expect(originAllowed("esempio.it", "esempio.it")).toBe(true);
    expect(originAllowed("www.esempio.it", "esempio.it")).toBe(true);
    expect(originAllowed("app.esempio.it", "esempio.it")).toBe(true);
  });
  it("localhost sempre ammesso per lo sviluppo", () => {
    expect(originAllowed("localhost:3000", "esempio.it")).toBe(true);
    expect(originAllowed("127.0.0.1:8080", "esempio.it")).toBe(true);
  });
  it("rifiuta altri domini e i suffissi falsi", () => {
    expect(originAllowed("altro.it", "esempio.it")).toBe(false);
    expect(originAllowed("fintoesempio.it", "esempio.it")).toBe(false);
    expect(originAllowed("esempio.it.attacker.com", "esempio.it")).toBe(false);
  });
});
```

**Step 2:** Run: `npx vitest run tests/lib/api-keys.test.ts`. Expected: FAIL, modulo mancante.

**Step 3: Implementazione**

```ts
/**
 * Primitive delle chiavi API. Edge-safe (solo Web Crypto): le usano sia il
 * middleware sia le server action.
 *
 * Nel DB si salva solo sha256(chiave). Il prefisso visibile ha 14 caratteri
 * come api_key_prefix di traffic_log, cosi' log e chiavi si incrociano.
 */

export const KEY_PREFIX = "eidx_live_";
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 32 caratteri base62 con rejection sampling (niente bias di modulo). */
export function generateApiKey(): string {
  let out = "";
  while (out.length < 32) {
    for (const b of crypto.getRandomValues(new Uint8Array(48))) {
      if (b < 248 && out.length < 32) out += ALPHABET[b % 62];
    }
  }
  return KEY_PREFIX + out;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function keyDisplayPrefix(key: string): string {
  return key.slice(0, 14);
}

/** Host normalizzato (minuscolo, senza www., senza porta e path) o null se non e' un dominio pubblico. */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  let host: string;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
  return host;
}

const DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** originHost come in traffic_log (host[:porta]). */
export function originAllowed(originHost: string, domain: string): boolean {
  const host = originHost.toLowerCase().split(":")[0];
  if (DEV_HOSTS.has(host)) return true;
  return host === domain || host.endsWith(`.${domain}`);
}
```

**Step 4:** Run: `npx vitest run tests/lib/api-keys.test.ts`. Expected: PASS.

**Step 5: Commit**

```bash
git add lib/api-keys/keys.ts tests/lib/api-keys.test.ts
git commit -m "feat(api-keys): generazione, hash, dominio e controllo Origin"
```

---

## Task 4: Parser dei link e stato della verifica

**Files:**
- Create: `lib/api-keys/link-check.ts`
- Test: `tests/lib/link-check.test.ts`

**Step 1: Test che fallisce**

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { hasEnergyIndexLink, nextLinkState } from "@/lib/api-keys/link-check";

describe("hasEnergyIndexLink", () => {
  it.each([
    ['<p>Fonte: <a href="https://energyindex.it">Energy Index</a></p>'],
    ["<a class='x' href='https://www.energyindex.it/it/indice/pun' rel='nofollow'>EI</a>"],
    ['<A HREF="//energyindex.it/">Energy Index</A>'],
    ['<a href=https://energyindex.pro>x</a>'],
  ])("trova il link in %s", (html) => {
    expect(hasEnergyIndexLink(html)).toBe(true);
  });

  it.each([
    ["<p>Fonte: Energy Index</p>"],
    ['<!-- <a href="https://energyindex.it">x</a> -->'],
    ['<a href="https://energyindex.it.evil.com">x</a>'],
    ['<a href="https://notenergyindex.it">x</a>'],
    ['<link rel="preconnect" href="https://energyindex.it">'],
  ])("non lo trova in %s", (html) => {
    expect(hasEnergyIndexLink(html)).toBe(false);
  });
});

describe("nextLinkState", () => {
  it("link presente: azzera i fallimenti e riattiva una chiave declassata", () => {
    expect(nextLinkState({ status: "downgraded", link_failures: 3 }, true)).toEqual({ status: "active", link_failures: 0, notify: "restored" });
    expect(nextLinkState({ status: "active", link_failures: 1 }, true)).toEqual({ status: "active", link_failures: 0, notify: null });
  });
  it("primo fallimento: solo conteggio", () => {
    expect(nextLinkState({ status: "active", link_failures: 0 }, false)).toEqual({ status: "active", link_failures: 1, notify: null });
  });
  it("secondo fallimento consecutivo: declassa e avvisa una volta", () => {
    expect(nextLinkState({ status: "active", link_failures: 1 }, false)).toEqual({ status: "downgraded", link_failures: 2, notify: "downgraded" });
    expect(nextLinkState({ status: "downgraded", link_failures: 2 }, false)).toEqual({ status: "downgraded", link_failures: 3, notify: null });
  });
});
```

**Step 2:** Run: `npx vitest run tests/lib/link-check.test.ts`. Expected: FAIL.

**Step 3: Implementazione**

```ts
/**
 * Verifica dell'attribuzione: la pagina dichiarata da chi ha una chiave deve
 * contenere un <a> verso energyindex.it. Accettiamo qualsiasi rel (anche
 * nofollow): pretendere un dofollow in cambio dell'accesso violerebbe le
 * policy di Google sui link scheme.
 */

const LINK_RE = /<a\b[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\/(?:www\.)?energyindex\.(?:it|pro)(?=[\/"'\s>?#]|$)/i;

export function hasEnergyIndexLink(html: string): boolean {
  return LINK_RE.test(html.replace(/<!--[\s\S]*?-->/g, ""));
}

export type KeyStatus = "pending" | "active" | "downgraded" | "revoked";

export interface LinkState {
  status: KeyStatus;
  link_failures: number;
}

export const FAILURES_BEFORE_DOWNGRADE = 2;

export function nextLinkState(
  cur: LinkState,
  ok: boolean,
): LinkState & { notify: "downgraded" | "restored" | null } {
  if (ok) {
    return { status: "active", link_failures: 0, notify: cur.status === "downgraded" ? "restored" : null };
  }
  const failures = cur.link_failures + 1;
  if (cur.status === "active" && failures >= FAILURES_BEFORE_DOWNGRADE) {
    return { status: "downgraded", link_failures: failures, notify: "downgraded" };
  }
  return { status: cur.status, link_failures: failures, notify: null };
}
```

**Step 4:** Run il test. Expected: PASS.

**Step 5: Commit**

```bash
git add lib/api-keys/link-check.ts tests/lib/link-check.test.ts
git commit -m "feat(api-keys): parser link di attribuzione e regole di declassamento"
```

---

## Task 5: Migrazione `api_keys`, `api_throttle` e RPC delle quote

**Files:**
- Create: `supabase/migrations/20261031000001_api_keys_throttle.sql`

**Step 1: Scrivi la migrazione**

```sql
-- ===== api_keys =====
-- Chiavi API self-service legate a un dominio. Si salva solo sha256(chiave).
-- Accesso solo con la service role: nessuna policy per anon/authenticated.
CREATE TABLE IF NOT EXISTS api_keys (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix             TEXT UNIQUE,                 -- "eidx_live_ab12", null finche' pending
  key_hash           TEXT UNIQUE,                 -- sha256 hex, null finche' pending
  email              TEXT NOT NULL,
  nome               TEXT NOT NULL,
  azienda            TEXT,
  progetto           TEXT,
  plan               TEXT NOT NULL DEFAULT 'developer'
                       CHECK (plan IN ('developer', 'api', 'pro', 'trading', 'enterprise')),
  domain             TEXT NOT NULL,
  attribution_url    TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'active', 'downgraded', 'revoked')),
  verify_token_hash  TEXT UNIQUE,
  verify_expires_at  TIMESTAMPTZ,
  link_checked_at    TIMESTAMPTZ,
  link_ok            BOOLEAN,
  link_failures      INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at       TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys (status);
CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys (lower(email));
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ===== api_throttle =====
-- Soggetti oltre quota: "key:<prefix>" o "ip:<ip_hash>". La scrive
-- refresh_api_throttle(), la legge il middleware (cache 60 s).
CREATE TABLE IF NOT EXISTS api_throttle (
  subject   TEXT PRIMARY KEY,
  until     TIMESTAMPTZ NOT NULL,
  requests  INT NOT NULL,
  window_limit INT NOT NULL
);
ALTER TABLE api_throttle ENABLE ROW LEVEL SECURITY;

-- Limite al minuto per piano, uguale a TIERS in lib/api/catalog.ts.
CREATE OR REPLACE FUNCTION api_plan_rate_per_minute(p TEXT) RETURNS INT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'developer' THEN 120
    WHEN 'api' THEN 600
    WHEN 'pro' THEN 1200
    WHEN 'trading' THEN 3000
    WHEN 'enterprise' THEN 100000
    ELSE 60 END
$$;

-- Quote "morbide": conta le chiamate degli ultimi 5 minuti in traffic_log e
-- blocca per 15 minuti chi supera 5 x limite/minuto. Le chiamate con chiave
-- non attiva (declassata, sconosciuta) contano come anonime, per IP.
CREATE OR REPLACE FUNCTION refresh_api_throttle() RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  DELETE FROM api_throttle WHERE until < now();

  WITH recent AS (
    SELECT t.api_key_prefix, t.ip_hash, k.plan
    FROM traffic_log t
    LEFT JOIN api_keys k ON k.prefix = t.api_key_prefix AND k.status = 'active'
    WHERE t.kind = 'api' AND t.ts > now() - interval '5 minutes'
  ),
  over AS (
    SELECT 'key:' || api_key_prefix AS subject, count(*)::int AS requests,
           5 * api_plan_rate_per_minute(plan) AS window_limit
    FROM recent WHERE plan IS NOT NULL
    GROUP BY api_key_prefix, plan
    HAVING count(*) > 5 * api_plan_rate_per_minute(plan)
    UNION ALL
    SELECT 'ip:' || ip_hash, count(*)::int, 5 * api_plan_rate_per_minute(NULL)
    FROM recent WHERE plan IS NULL AND ip_hash IS NOT NULL
    GROUP BY ip_hash
    HAVING count(*) > 5 * api_plan_rate_per_minute(NULL)
  )
  INSERT INTO api_throttle (subject, until, requests, window_limit)
  SELECT subject, now() + interval '15 minutes', requests, window_limit FROM over
  ON CONFLICT (subject) DO UPDATE
    SET until = EXCLUDED.until, requests = EXCLUDED.requests, window_limit = EXCLUDED.window_limit;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION refresh_api_throttle() FROM PUBLIC, anon, authenticated;

-- Nessun segreto nel comando: puo' stare nella migrazione (a differenza
-- dei cron ETL che chiamano le Edge Function con la service key).
SELECT cron.schedule('api-throttle-refresh', '*/5 * * * *', $$SELECT public.refresh_api_throttle()$$);
```

**Step 2:** Applica la migrazione con il Supabase MCP `apply_migration` (name: `api_keys_throttle`). Se è bloccata, chiedi al titolare di eseguire il file dall'SQL Editor.

**Step 3: Verifica**

```sql
SELECT public.refresh_api_throttle();            -- atteso: 0 o un numero piccolo
SELECT jobname, schedule FROM cron.job WHERE jobname = 'api-throttle-refresh';
```

Poi lancia il security advisor (`get_advisors type=security`). Atteso: nessun warning nuovo su `api_keys` o `api_throttle`. RLS attiva senza policy è voluto.

**Step 4: Commit**

```bash
git add supabase/migrations/20261031000001_api_keys_throttle.sql
git commit -m "feat(db): api_keys, api_throttle e quote calcolate da traffic_log"
```

---

## Task 6: Decisione di accesso (pura)

**Files:**
- Create: `lib/api-keys/gate.ts`
- Test: `tests/lib/api-gate.test.ts`

**Step 1: Test che fallisce**

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { decideAccess, type KeyRecord } from "@/lib/api-keys/gate";

const active: KeyRecord = { prefix: "eidx_live_ab12", status: "active", domain: "esempio.it", plan: "developer" };
const base = { hasKey: false, key: null, lookupFailed: false, originHost: null, throttledKey: false, throttledIp: false };

describe("decideAccess", () => {
  it("anonimo: passa con il limite Open", () => {
    const r = decideAccess(base);
    expect(r.ok).toBe(true);
    expect(r.headers["X-RateLimit-Limit"]).toBe("60");
  });

  it("chiave sconosciuta o revocata: 401", () => {
    expect(decideAccess({ ...base, hasKey: true }).ok).toBe(false);
    const r = decideAccess({ ...base, hasKey: true, key: { ...active, status: "revoked" } });
    expect(r.ok === false && r.status).toBe(401);
  });

  it("DB irraggiungibile: fail-open come anonimo", () => {
    expect(decideAccess({ ...base, hasKey: true, lookupFailed: true }).ok).toBe(true);
  });

  it("chiave attiva dal suo dominio: passa con il limite del piano", () => {
    const r = decideAccess({ ...base, hasKey: true, key: active, originHost: "www.esempio.it" });
    expect(r.ok).toBe(true);
    expect(r.headers["X-RateLimit-Limit"]).toBe("120");
    expect(r.headers["X-EIDX-Key-Status"]).toBe("active");
  });

  it("chiave usata da un altro sito: 403 origin_not_allowed", () => {
    const r = decideAccess({ ...base, hasKey: true, key: active, originHost: "altro.it" });
    expect(r.ok === false && r.status).toBe(403);
    expect(r.ok === false && r.body.error).toBe("origin_not_allowed");
  });

  it("chiamata server senza Origin: passa", () => {
    expect(decideAccess({ ...base, hasKey: true, key: active }).ok).toBe(true);
  });

  it("chiave declassata: limiti Open e avviso nell'header", () => {
    const r = decideAccess({ ...base, hasKey: true, key: { ...active, status: "downgraded" } });
    expect(r.ok).toBe(true);
    expect(r.headers["X-RateLimit-Limit"]).toBe("60");
    expect(r.headers["X-EIDX-Notice"]).toBe("attribution-missing");
  });

  it("oltre quota: 429 con Retry-After", () => {
    const r1 = decideAccess({ ...base, hasKey: true, key: active, throttledKey: true });
    expect(r1.ok === false && r1.status).toBe(429);
    expect(r1.headers["Retry-After"]).toBe("900");
    const r2 = decideAccess({ ...base, throttledIp: true });
    expect(r2.ok === false && r2.status).toBe(429);
  });

  it("una chiave attiva non paga il throttle per IP condiviso", () => {
    expect(decideAccess({ ...base, hasKey: true, key: active, throttledIp: true }).ok).toBe(true);
  });
});
```

**Step 2:** Run: `npx vitest run tests/lib/api-gate.test.ts`. Expected: FAIL.

**Step 3: Implementazione**

```ts
/**
 * Decisione di accesso alle API pubbliche, pura: il middleware raccoglie
 * chiave, Origin e stato di throttle e applica il risultato.
 */

import { originAllowed } from "./keys";
import type { KeyStatus } from "./link-check";

export interface KeyRecord {
  prefix: string;
  status: KeyStatus;
  domain: string;
  plan: string;
}

export interface GateInput {
  hasKey: boolean;
  key: KeyRecord | null;
  /** Lookup fallito (DB irraggiungibile): non si punisce l'utente. */
  lookupFailed: boolean;
  originHost: string | null;
  throttledKey: boolean;
  throttledIp: boolean;
}

export type GateResult =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; status: 401 | 403 | 429; body: { error: string; message: string; attribution: string }; headers: Record<string, string> };

/** Uguali a TIERS.rateLimit in lib/api/catalog.ts e a api_plan_rate_per_minute(). */
export const RATE_PER_MINUTE: Record<string, number> = {
  open: 60,
  developer: 120,
  api: 600,
  pro: 1200,
  trading: 3000,
  enterprise: 100000,
};

const ATTR = "Energy Index — https://energyindex.it";
const THROTTLE_SECONDS = 900;

function deny(status: 401 | 403 | 429, error: string, message: string, headers: Record<string, string> = {}): GateResult {
  return { ok: false, status, body: { error, message, attribution: ATTR }, headers };
}

export function decideAccess(i: GateInput): GateResult {
  if (i.hasKey && !i.lookupFailed) {
    if (!i.key || i.key.status === "revoked" || i.key.status === "pending") {
      return deny(401, "invalid_key", "Chiave API non valida o revocata.");
    }
    if (i.originHost && !originAllowed(i.originHost, i.key.domain)) {
      return deny(403, "origin_not_allowed", `Questa chiave e' abilitata solo per ${i.key.domain}.`);
    }
  }

  const activeKey = i.key && i.key.status === "active" && !i.lookupFailed ? i.key : null;
  const tier = activeKey ? activeKey.plan : "open";
  const headers: Record<string, string> = { "X-RateLimit-Limit": String(RATE_PER_MINUTE[tier] ?? 60) };
  if (i.key && !i.lookupFailed) headers["X-EIDX-Key-Status"] = i.key.status;
  if (i.key?.status === "downgraded") headers["X-EIDX-Notice"] = "attribution-missing";

  const throttled = activeKey ? i.throttledKey : i.throttledIp;
  if (throttled) {
    return deny(429, "rate_limited", "Limite di richieste superato. Riprova tra qualche minuto.", {
      ...headers,
      "Retry-After": String(THROTTLE_SECONDS),
    });
  }
  return { ok: true, headers };
}
```

**Step 4:** Run il test. Expected: PASS.

**Step 5: Commit**

```bash
git add lib/api-keys/gate.ts tests/lib/api-gate.test.ts
git commit -m "feat(api-keys): decisione di accesso pura (chiave, Origin, quote)"
```

---

## Task 7: Lookup con cache per il middleware

**Files:**
- Create: `lib/api-keys/lookup.ts`
- Test: `tests/lib/api-lookup.test.ts`

**Step 1: Test che fallisce** (fetch iniettato, niente rete)

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLookup } from "@/lib/api-keys/lookup";

const env = { url: "https://db.test", serviceKey: "svc" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createLookup", () => {
  let now = 0;
  beforeEach(() => { now = 1_000_000; });

  it("trova la chiave per hash e la tiene in cache 60 s", async () => {
    const fetchFn = vi.fn(async () => jsonResponse([{ prefix: "eidx_live_ab12", status: "active", domain: "esempio.it", plan: "developer" }]));
    const lk = createLookup({ ...env, fetchFn, now: () => now });
    expect((await lk.key("h1")).key?.domain).toBe("esempio.it");
    await lk.key("h1");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    now += 61_000;
    await lk.key("h1");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[0][0])).toContain("key_hash=eq.h1");
  });

  it("chiave inesistente: key null, nessun errore", async () => {
    const lk = createLookup({ ...env, fetchFn: async () => jsonResponse([]), now: () => now });
    expect(await lk.key("nope")).toEqual({ key: null, failed: false });
  });

  it("errore DB: failed true, nessuna cache", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ message: "boom" }, 500));
    const lk = createLookup({ ...env, fetchFn, now: () => now });
    expect((await lk.key("h1")).failed).toBe(true);
    await lk.key("h1");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throttled restituisce l'insieme dei soggetti attivi", async () => {
    const lk = createLookup({ ...env, fetchFn: async () => jsonResponse([{ subject: "ip:abc" }, { subject: "key:eidx_live_ab12" }]), now: () => now });
    const s = await lk.throttled();
    expect(s.has("ip:abc")).toBe(true);
    expect(s.has("key:eidx_live_ab12")).toBe(true);
  });

  it("throttled con DB giu': insieme vuoto (fail-open)", async () => {
    const lk = createLookup({ ...env, fetchFn: async () => { throw new Error("down"); }, now: () => now });
    expect((await lk.throttled()).size).toBe(0);
  });
});
```

**Step 2:** Run: `npx vitest run tests/lib/api-lookup.test.ts`. Expected: FAIL.

**Step 3: Implementazione**

```ts
/**
 * Letture del middleware su api_keys e api_throttle via PostgREST con la
 * service role (stesso schema di lib/traffic/log.ts: niente supabase-js su
 * edge). Cache in memoria per istanza, TTL 60 s. Su errore fail-open: un DB
 * lento non deve rompere le API pubbliche.
 */

import type { KeyRecord } from "./gate";

const TTL_MS = 60_000;

interface Deps {
  url: string;
  serviceKey: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export function createLookup({ url, serviceKey, fetchFn = fetch, now = Date.now }: Deps) {
  const keys = new Map<string, { key: KeyRecord | null; exp: number }>();
  let thr: { set: Set<string>; exp: number } | null = null;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  async function get<T>(path: string): Promise<T> {
    const res = await fetchFn(`${url}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(1500) });
    if (!res.ok) throw new Error(`postgrest ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    async key(hash: string): Promise<{ key: KeyRecord | null; failed: boolean }> {
      const hit = keys.get(hash);
      if (hit && hit.exp > now()) return { key: hit.key, failed: false };
      try {
        const rows = await get<KeyRecord[]>(
          `api_keys?key_hash=eq.${encodeURIComponent(hash)}&select=prefix,status,domain,plan&limit=1`,
        );
        const key = rows[0] ?? null;
        keys.set(hash, { key, exp: now() + TTL_MS });
        return { key, failed: false };
      } catch {
        return { key: null, failed: true };
      }
    },

    async throttled(): Promise<Set<string>> {
      if (thr && thr.exp > now()) return thr.set;
      try {
        const rows = await get<{ subject: string }[]>(
          `api_throttle?until=gt.${encodeURIComponent(new Date(now()).toISOString())}&select=subject`,
        );
        thr = { set: new Set(rows.map((r) => r.subject)), exp: now() + TTL_MS };
        return thr.set;
      } catch {
        return new Set();
      }
    },
  };
}

let shared: ReturnType<typeof createLookup> | null = null;

/** Istanza condivisa del modulo (una per isolate edge). Null senza env. */
export function sharedLookup() {
  if (shared) return shared;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  shared = createLookup({ url, serviceKey });
  return shared;
}
```

**Step 4:** Run il test. Expected: PASS.

**Step 5: Commit**

```bash
git add lib/api-keys/lookup.ts tests/lib/api-lookup.test.ts
git commit -m "feat(api-keys): lookup chiavi e throttle con cache per il middleware"
```

---

## Task 8: Collegare il controllo al middleware

**Files:**
- Modify: `middleware.ts` (ramo `/api/v1`, circa riga 99)
- Modify: `lib/traffic/log.ts` (esporta una funzione che estrae la chiave completa)
- Test: `tests/lib/traffic-log.test.ts` (crealo se non esiste, solo per `extractApiKey`)

**Step 1: Test di `extractApiKey`**

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { extractApiKey } from "@/lib/traffic/log";

describe("extractApiKey", () => {
  it("preferisce l'header Bearer alla querystring", () => {
    const h = new Headers({ authorization: "Bearer eidx_live_AAA" });
    expect(extractApiKey(h, new URLSearchParams("key=eidx_live_BBB"))).toBe("eidx_live_AAA");
  });
  it("accetta ?key= per compatibilita'", () => {
    expect(extractApiKey(new Headers(), new URLSearchParams("key=eidx_live_BBB"))).toBe("eidx_live_BBB");
  });
  it("null senza chiave", () => {
    expect(extractApiKey(new Headers(), new URLSearchParams())).toBeNull();
  });
});
```

Run il test. Expected: FAIL (`extractApiKey` non esportata).

**Step 2:** In `lib/traffic/log.ts` estrai la logica da `apiKeyPrefix`:

```ts
/** Chiave API completa: header Bearer, poi ?key= (sconsigliato: spezza la cache CDN). */
export function extractApiKey(headers: Headers, searchParams: URLSearchParams): string | null {
  const bearer = headers.get("authorization")?.match(/^Bearer\s+(\S+)/i)?.[1];
  return bearer ?? searchParams.get("key");
}

/** Primi 14 caratteri della chiave (es. "eidx_live_ab12"): identifica senza esporre. */
export function apiKeyPrefix(headers: Headers, searchParams: URLSearchParams): string | null {
  const key = extractApiKey(headers, searchParams);
  return key ? key.slice(0, 14) : null;
}
```

Run il test. Expected: PASS. Anche gli altri test sul traffico devono restare verdi: `npx vitest run tests/lib/traffic.test.ts`.

**Step 3: Middleware.** Sostituisci il blocco `/api/v1` con:

```ts
  if (path === "/api/v1" || path.startsWith("/api/v1/")) {
    if (request.method === "OPTIONS") return NextResponse.next();
    logTraffic("api", request, event);
    return gateApi(request);
  }
```

e aggiungi, sopra `middleware`:

```ts
/**
 * Chiave, Origin e quote per /api/v1. Gira prima della cache CDN, quindi
 * vale anche per le risposte servite dalla cache. Senza env (dev senza
 * service key) lascia passare tutto.
 */
async function gateApi(request: NextRequest): Promise<NextResponse> {
  const lookup = sharedLookup();
  if (!lookup) return NextResponse.next();

  const key = extractApiKey(request.headers, request.nextUrl.searchParams);
  const originHeader = request.headers.get("origin");
  let originHost: string | null = null;
  try {
    originHost = originHeader ? new URL(originHeader).host : null;
  } catch {
    originHost = null;
  }

  const [found, throttled, ipHash] = await Promise.all([
    key ? lookup.key(await sha256Hex(key)) : Promise.resolve({ key: null, failed: false }),
    lookup.throttled(),
    hashIp(clientIp(request.headers), hashSalt()),
  ]);

  const decision = decideAccess({
    hasKey: Boolean(key),
    key: found.key,
    lookupFailed: found.failed,
    originHost,
    throttledKey: found.key ? throttled.has(`key:${found.key.prefix}`) : false,
    throttledIp: ipHash ? throttled.has(`ip:${ipHash}`) : false,
  });

  if (!decision.ok) {
    return NextResponse.json(decision.body, {
      status: decision.status,
      headers: {
        ...decision.headers,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(decision.headers)) res.headers.set(k, v);
  return res;
}
```

Import da aggiungere: `sharedLookup` da `./lib/api-keys/lookup`, `decideAccess` da `./lib/api-keys/gate`, `sha256Hex` da `./lib/api-keys/keys`, e `extractApiKey`, `hashIp`, `clientIp` da `./lib/traffic/log` (accanto agli import esistenti).

**Step 4: Verifica locale**

```bash
npx tsc --noEmit -p .
```

Con il dev server avviato (`.env.local` ha la service key, quindi il gate è attivo):

```bash
curl -si http://localhost:<porta>/api/v1/pun/today | head -12                                        # 200, X-RateLimit-Limit: 60
curl -si -H "Authorization: Bearer eidx_live_FAKEFAKE" http://localhost:<porta>/api/v1/pun/today | head -5   # 401 invalid_key
```

**Step 5: Commit**

```bash
git add middleware.ts lib/traffic/log.ts tests/lib/traffic-log.test.ts
git commit -m "feat(api): middleware applica chiave, Origin e quote su /api/v1"
```

---

## Task 9: Rilascio self-service (richiesta + verifica email)

**Files:**
- Create: `lib/api-keys/issue.ts` (server-only: crea la riga pending, attiva, manda le email)
- Modify: `app/actions/request-api-key.ts` (piano `developer` → nuovo flusso; gli altri piani restano come oggi)
- Modify: `components/api/ApiKeyRequestForm.tsx` (campi dominio e URL attribuzione per Developer; messaggio di successo nuovo)
- Create: `app/[locale]/api/chiave/verifica/page.tsx` e `app/actions/activate-api-key.ts`
- Test: `tests/lib/api-key-issue.test.ts` (validazione pura)

**Step 1: Test della validazione** (parte pura di `issue.ts`, esportata come `validateDeveloperRequest`)

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { validateDeveloperRequest } from "@/lib/api-keys/issue";

const ok = { nome: "Giovanni", email: "g@esempio.it", dominio: "www.esempio.it", attributionUrl: "https://esempio.it/prezzi", progetto: "Widget PUN sul blog" };

describe("validateDeveloperRequest", () => {
  it("normalizza il dominio", () => {
    expect(validateDeveloperRequest(ok)).toEqual({ ok: true, domain: "esempio.it" });
  });
  it("la pagina di attribuzione deve stare sul dominio dichiarato", () => {
    const r = validateDeveloperRequest({ ...ok, attributionUrl: "https://altro.it/x" });
    expect(r.ok).toBe(false);
  });
  it("rifiuta dominio non valido e URL non https", () => {
    expect(validateDeveloperRequest({ ...ok, dominio: "localhost" }).ok).toBe(false);
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "ftp://esempio.it" }).ok).toBe(false);
  });
  it("rifiuta pagine su loopback anche se il dominio e' valido", () => {
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "http://127.0.0.1/x" }).ok).toBe(false);
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "http://localhost:3000/x" }).ok).toBe(false);
  });
});
```

Run. Expected: FAIL.

**Step 2: `lib/api-keys/issue.ts`**

```ts
import "server-only";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { generateApiKey, hostMatchesDomain, keyDisplayPrefix, normalizeDomain, sha256Hex } from "./keys";
import { hasEnergyIndexLink } from "./link-check";

export interface DeveloperRequest {
  nome: string;
  email: string;
  azienda?: string;
  dominio: string;
  attributionUrl: string;
  progetto: string;
}

export function validateDeveloperRequest(d: DeveloperRequest): { ok: true; domain: string } | { ok: false; error: string } {
  const domain = normalizeDomain(d.dominio);
  if (!domain) return { ok: false, error: "Dominio non valido (es. tuosito.it)" };
  let page: URL;
  try {
    page = new URL(d.attributionUrl.trim());
  } catch {
    return { ok: false, error: "Indirizzo della pagina non valido" };
  }
  if (page.protocol !== "https:" && page.protocol !== "http:") return { ok: false, error: "La pagina deve essere http o https" };
  // hostMatchesDomain, non originAllowed: niente eccezione localhost/127.0.0.1,
  // altrimenti il link checker scaricherebbe indirizzi di loopback (SSRF).
  if (!hostMatchesDomain(page.host, domain)) {
    return { ok: false, error: `La pagina deve stare su ${domain}` };
  }
  return { ok: true, domain };
}

const SITE = "https://energyindex.it";
const SENDER = process.env.RESEND_SENDER_EMAIL || "EIDX Pro <onboarding@resend.dev>";

async function send(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const res = await new Resend(apiKey).emails.send({ from: SENDER, to, subject, text, replyTo: "pro@energyindex.pro" });
  return !res.error;
}

/** Crea la richiesta pending e manda il link di verifica (valido 24 ore). */
export async function startDeveloperRequest(d: DeveloperRequest, domain: string): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceClient();
  if (!db) return { ok: false, error: "Servizio non configurato" };
  const token = generateApiKey().slice(10); // 32 caratteri casuali, stesso generatore
  const { error } = await db.from("api_keys").insert({
    email: d.email.trim().toLowerCase(),
    nome: d.nome.trim(),
    azienda: d.azienda?.trim() || null,
    progetto: d.progetto.trim(),
    domain,
    attribution_url: d.attributionUrl.trim(),
    verify_token_hash: await sha256Hex(token),
    verify_expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  });
  if (error) return { ok: false, error: "Impossibile registrare la richiesta" };
  const sent = await send(
    d.email,
    "Conferma la tua chiave API Energy Index",
    [
      `Ciao ${d.nome},`,
      "",
      `per attivare la chiave Developer per ${domain} apri questo link entro 24 ore:`,
      `${SITE}/it/api/chiave/verifica?t=${token}`,
      "",
      "Ricorda: accanto ai dati va mostrato il link \"Fonte: Energy Index\" (https://energyindex.it).",
      "Lo verifichiamo ogni settimana sulla pagina che ci hai indicato.",
    ].join("\n"),
  );
  return sent ? { ok: true } : { ok: false, error: "Invio email non riuscito" };
}

/** Attiva la richiesta e restituisce la chiave in chiaro (unica volta). */
export async function activateDeveloperKey(token: string): Promise<
  { ok: true; key: string; domain: string; linkFound: boolean } | { ok: false; error: string }
> {
  const db = createServiceClient();
  if (!db) return { ok: false, error: "Servizio non configurato" };
  const { data: row } = await db
    .from("api_keys")
    .select("id, email, nome, domain, attribution_url, status, verify_expires_at")
    .eq("verify_token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!row || row.status !== "pending") return { ok: false, error: "Link non valido o gia' usato" };
  if (new Date(row.verify_expires_at) < new Date()) return { ok: false, error: "Link scaduto: ripeti la richiesta" };

  const key = generateApiKey();
  const linkFound = await fetchHasLink(row.attribution_url);
  const { error } = await db
    .from("api_keys")
    .update({
      prefix: keyDisplayPrefix(key),
      key_hash: await sha256Hex(key),
      status: "active",
      activated_at: new Date().toISOString(),
      verify_token_hash: null,
      link_checked_at: new Date().toISOString(),
      link_ok: linkFound,
    })
    .eq("id", row.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: "Attivazione non riuscita" };

  await send(
    row.email,
    "La tua chiave API Energy Index",
    [
      `Ciao ${row.nome},`,
      "",
      `ecco la tua chiave Developer per ${row.domain}:`,
      key,
      "",
      "Usala nell'header: Authorization: Bearer <chiave>",
      "Documentazione: https://energyindex.it/it/api/docs",
      "",
      linkFound
        ? "Abbiamo trovato il link di attribuzione sulla tua pagina: grazie!"
        : `Non abbiamo ancora trovato il link a energyindex.it su ${row.attribution_url}: aggiungilo prima della verifica settimanale.`,
    ].join("\n"),
  );
  return { ok: true, key, domain: row.domain, linkFound };
}

export async function fetchHasLink(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EnergyIndexLinkCheck/1.0 (+https://energyindex.it/it/api/docs#licenza)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    return hasEnergyIndexLink((await res.text()).slice(0, 2_000_000));
  } catch {
    return false;
  }
}
```

Run il test della validazione. Expected: PASS.

**Step 3: Server action.** In `app/actions/request-api-key.ts`:
- estendi `ApiKeyRequestData` con `dominio?: string` e `attributionUrl?: string`;
- all'inizio di `requestApiKey`, se `d.piano === "developer"`, chiama `validateDeveloperRequest`, poi `saveLead` come oggi, poi `startDeveloperRequest`, e restituisci `{ ok: true, mode: "verify" }`;
- gli altri piani seguono il codice attuale e restituiscono `{ ok: true, mode: "manual" }`;
- aggiorna il tipo del risultato in `{ ok: true; mode: "verify" | "manual" } | ...`.

Prima di creare una nuova richiesta, controlla che non ci sia già una riga `pending` o `active` con la stessa email e lo stesso dominio. Se c'è, restituisci l'errore "Esiste già una chiave per questo dominio: scrivi a pro@energyindex.pro".

**Step 4: Form.** In `components/api/ApiKeyRequestForm.tsx`:
- quando `piano === "developer"`, mostra i campi "Dominio del sito" (placeholder `tuosito.it`) e "Pagina dove mostri i dati" (placeholder `https://tuosito.it/prezzi-energia`), con un help text: "Lì deve comparire il link «Fonte: Energy Index». Lo verifichiamo ogni settimana.";
- `isValid` richiede i due campi quando il piano è Developer;
- messaggio di successo per `mode === "verify"`: "Controlla la posta: ti abbiamo mandato il link per attivare la chiave (valido 24 ore)". Per `manual` resta il testo attuale.

**Step 5: Pagina di verifica.** `app/[locale]/api/chiave/verifica/page.tsx`: server component con `searchParams: Promise<{ t?: string }>`, `robots: noindex`. Mostra un form con un solo pulsante "Attiva la chiave" che passa il token a una server action (`app/actions/activate-api-key.ts` → `activateDeveloperKey`). **Non attivare sul GET**: gli antivirus delle email aprono i link in anticipo e consumerebbero il token. Il risultato è un client component che mostra:
- la chiave in un blocco monospazio con il pulsante "copia";
- l'avviso "Non la mostreremo di nuovo, l'abbiamo mandata anche per email";
- l'esito della verifica del link, e se manca lo snippet di attribuzione da copiare.

**Step 6: Verifica manuale in locale** (scrive sul DB di produzione: usa un tuo indirizzo email e un dominio tuo, poi revoca la riga da admin o via SQL):
1. compila il form Developer;
2. ricevi l'email;
3. apri il link e attiva;
4. `curl -H "Authorization: Bearer <chiave>"` → 200 con `X-EIDX-Key-Status: active`;
5. con `-H "Origin: https://altro.it"` → 403.

**Step 7: Commit**

```bash
git add lib/api-keys/issue.ts app/actions/request-api-key.ts app/actions/activate-api-key.ts components/api/ApiKeyRequestForm.tsx "app/[locale]/api/chiave/verifica/page.tsx" tests/lib/api-key-issue.test.ts
git commit -m "feat(api-keys): rilascio self-service Developer con verifica email"
```

---

## Task 10: Verifica settimanale dei link

**Files:**
- Create: `scripts/check-attribution-links.ts`
- Create: `.github/workflows/check-attribution-links.yml`

**Step 1: Script** (usa le funzioni già testate `nextLinkState`, `hasEnergyIndexLink` e `fetchHasLink`; per importare `issue.ts` fuori da Next, sposta `fetchHasLink` in `lib/api-keys/link-check.ts`, che non è server-only, e aggiorna l'import in `issue.ts`)

```ts
/**
 * Verifica settimanale dell'attribuzione: per ogni chiave attiva o
 * declassata scarica la pagina dichiarata e cerca un link a energyindex.it.
 * Due fallimenti consecutivi → declassata ai limiti Open + email.
 * Eccezione: se il widget e' stato chiamato da quel dominio negli ultimi 7
 * giorni il link c'e' per forza (il widget non funziona senza).
 *
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... npx tsx scripts/check-attribution-links.ts
 */
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { fetchHasLink, nextLinkState, type KeyStatus } from "../lib/api-keys/link-check";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const SENDER = process.env.RESEND_SENDER_EMAIL || "EIDX Pro <onboarding@resend.dev>";

async function widgetSeen(domain: string): Promise<boolean> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { count } = await db
    .from("traffic_log")
    .select("id", { count: "exact", head: true })
    .in("origin_host", [domain, `www.${domain}`])
    .ilike("query", "%src=widget%")
    .gt("ts", since);
  return (count ?? 0) > 0;
}

async function main() {
  const { data: keys, error } = await db
    .from("api_keys")
    .select("id, email, nome, domain, attribution_url, status, link_failures")
    .in("status", ["active", "downgraded"]);
  if (error) throw new Error(error.message);

  let downgraded = 0, restored = 0;
  for (const k of keys ?? []) {
    const ok = (await fetchHasLink(k.attribution_url)) || (await widgetSeen(k.domain));
    const next = nextLinkState({ status: k.status as KeyStatus, link_failures: k.link_failures }, ok);
    await db.from("api_keys").update({
      status: next.status,
      link_failures: next.link_failures,
      link_ok: ok,
      link_checked_at: new Date().toISOString(),
    }).eq("id", k.id);

    if (next.notify && resend) {
      const text = next.notify === "downgraded"
        ? `Ciao ${k.nome},\n\nda due settimane non troviamo il link "Fonte: Energy Index" su ${k.attribution_url}. La chiave per ${k.domain} funziona ancora, ma con i limiti del piano Open.\n\nRimetti il link (https://energyindex.it) e alla prossima verifica torna attiva.`
        : `Ciao ${k.nome},\n\nabbiamo ritrovato il link di attribuzione su ${k.attribution_url}: la chiave per ${k.domain} e' di nuovo attiva con i limiti Developer. Grazie!`;
      await resend.emails.send({ from: SENDER, to: k.email, replyTo: "pro@energyindex.pro", subject: next.notify === "downgraded" ? "Chiave API Energy Index: manca l'attribuzione" : "Chiave API Energy Index riattivata", text });
    }
    if (next.notify === "downgraded") downgraded++;
    if (next.notify === "restored") restored++;
  }
  console.log(JSON.stringify({ checked: keys?.length ?? 0, downgraded, restored }));
}

main().catch((e) => { console.error(e); process.exit(1); });
```

**Step 2: Workflow** (copia la struttura di `.github/workflows/etl-ttf-daily.yml`: checkout, setup-node 20, `npm ci`, run)

```yaml
name: Verifica link attribuzione chiavi API
on:
  schedule:
    - cron: "0 7 * * 1" # lunedi' 08:00/09:00 Europe/Rome
  workflow_dispatch: {}
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx tsx scripts/check-attribution-links.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          RESEND_SENDER_EMAIL: ${{ secrets.RESEND_SENDER_EMAIL }}
```

Verifica nel file `etl-ttf-daily.yml` i nomi reali dei secret (`SUPABASE_URL` o un altro nome) e usa gli stessi. Se `RESEND_*` non è tra i secret del repo, segnalalo al titolare: lo script funziona anche senza, solo senza email.

**Step 3: Verifica locale**

```bash
set -a; source .env.local; set +a
SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL RESEND_API_KEY= npx tsx scripts/check-attribution-links.ts
```

Expected: JSON `{"checked":N,...}` senza errori. `RESEND_API_KEY` vuota evita di mandare email vere.

**Step 4: Commit**

```bash
git add scripts/check-attribution-links.ts .github/workflows/check-attribution-links.yml lib/api-keys/link-check.ts lib/api-keys/issue.ts
git commit -m "feat(api-keys): verifica settimanale dei link di attribuzione"
```

---

## Task 11: Logica pura del widget

**Files:**
- Create: `lib/widget/core.ts`
- Test: `tests/lib/widget-core.test.ts`

**Step 1: Test che fallisce** (jsdom non calcola il layout, quindi la visibilità viene iniettata)

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { findAttribution, WIDGET_VARIANTS, formatEuro, readModel } from "@/lib/widget/core";

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.querySelector(".eidx-widget") as HTMLElement;
}
const visible = () => true;

describe("findAttribution", () => {
  it("trova un link visibile a energyindex.it con testo", () => {
    const el = mount('<div class="eidx-widget"><p>Fonte: <a href="https://energyindex.it">Energy Index</a></p></div>');
    expect(findAttribution(el, visible)).not.toBeNull();
  });
  it("null se il link manca, punta altrove o non ha testo", () => {
    expect(findAttribution(mount('<div class="eidx-widget"><p>Fonte: Energy Index</p></div>'), visible)).toBeNull();
    expect(findAttribution(mount('<div class="eidx-widget"><a href="https://altro.it">Energy Index</a></div>'), visible)).toBeNull();
    expect(findAttribution(mount('<div class="eidx-widget"><a href="https://energyindex.it"> </a></div>'), visible)).toBeNull();
  });
  it("null se il link e' nascosto", () => {
    const el = mount('<div class="eidx-widget"><a href="https://energyindex.it">Energy Index</a></div>');
    expect(findAttribution(el, () => false)).toBeNull();
  });
});

describe("WIDGET_VARIANTS", () => {
  it("le varianti GME richiedono la riga di fonte GME", () => {
    expect(WIDGET_VARIANTS.pun.gme).toBe(true);
    expect(WIDGET_VARIANTS.psv.gme).toBe(true);
    expect(WIDGET_VARIANTS["indice-luce"].gme).toBe(false);
  });
});

describe("formatEuro", () => {
  it("formato italiano con unita'", () => {
    expect(formatEuro(274.04, "€/MWh", 2)).toBe("274,04 €/MWh");
    expect(formatEuro(0.129, "€/kWh", 3)).toBe("0,129 €/kWh");
  });
});

describe("readModel", () => {
  it("PUN: media del giorno da daily_average", () => {
    const m = readModel("pun", { daily_average: { date: "2026-10-30", value_native: 274.04, unit_native: "€/MWh" } });
    expect(m).toEqual({ title: "PUN medio", rows: [{ label: "30/10/2026", value: "274,04 €/MWh" }] });
  });
  it("indice luce: fisso come prezzo, variabile come spread sull'indice", () => {
    const m = readModel("indice-luce", { indices: [
      { slug: "mercato-libero-luce-variabile", median: 0.055, unit: "€/kWh", date: "2026-10-30", basis: "spread", reference: "PUN" },
      { slug: "mercato-libero-luce-fissa", median: 0.3495, unit: "€/kWh", date: "2026-10-30", basis: "prezzo" },
    ] });
    expect(m?.rows).toEqual([
      { label: "Prezzo fisso", value: "0,350 €/kWh" },
      { label: "Prezzo variabile", value: "PUN + 0,055 €/kWh" },
    ]);
    expect(m?.date).toBe("30/10/2026");
  });
  it("risposta inattesa: null", () => {
    expect(readModel("pun", {})).toBeNull();
  });
});
```

**Step 2:** Run: `npx vitest run tests/lib/widget-core.test.ts`. Expected: FAIL.

**Step 3: Implementazione**

```ts
/**
 * Logica pura del widget embeddabile (nessun accesso a window globale se
 * non tramite gli argomenti): testabile con jsdom e inclusa nel bundle
 * public/widget.js.
 */

export type WidgetVariant = "indice-luce" | "indice-gas" | "pun" | "psv";

export const WIDGET_VARIANTS: Record<WidgetVariant, { endpoint: string; gme: boolean; page: string; label: string }> = {
  "indice-luce": { endpoint: "/api/v1/energy-index?commodity=luce", gme: false, page: "https://energyindex.it/it/mercato-libero", label: "Energy Index · Luce" },
  "indice-gas": { endpoint: "/api/v1/energy-index?commodity=gas", gme: false, page: "https://energyindex.it/it/mercato-libero", label: "Energy Index · Gas" },
  pun: { endpoint: "/api/v1/pun/today", gme: true, page: "https://energyindex.it/it/indice/pun", label: "PUN di oggi" },
  psv: { endpoint: "/api/v1/psv/today", gme: true, page: "https://energyindex.it/it/indice/psv", label: "PSV giorno gas" },
};

const HOST_RE = /^https?:\/\/(www\.)?energyindex\.(it|pro)(\/|$)/i;

/** Link di attribuzione valido e visibile dentro il widget, o null. */
export function findAttribution(root: HTMLElement, isVisible: (a: HTMLAnchorElement) => boolean): HTMLAnchorElement | null {
  for (const a of Array.from(root.querySelectorAll("a"))) {
    if (HOST_RE.test(a.href) && (a.textContent ?? "").trim().length > 0 && isVisible(a)) return a;
  }
  return null;
}

/** Visibilita' reale nel browser (in jsdom non c'e' layout: nei test si inietta). */
export function isRenderedVisible(a: HTMLAnchorElement): boolean {
  if (a.getClientRects().length === 0) return false;
  for (let el: HTMLElement | null = a; el; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.3) return false;
  }
  const r = a.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}

export function formatEuro(v: number, unit: string, decimals: number): string {
  return `${v.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`;
}

const itDate = (iso: string) => iso.split("-").reverse().join("/");

export interface WidgetModel {
  title: string;
  /** Data del dato (gg/mm/aaaa), mostrata nel widget: gli indici offerte possono essere di qualche giorno fa. */
  date?: string;
  rows: { label: string; value: string }[];
}

type Json = Record<string, unknown>;

export function readModel(variant: WidgetVariant, body: Json): WidgetModel | null {
  if (variant === "pun") {
    const d = body.daily_average as { date?: string; value_native?: number; unit_native?: string } | undefined;
    if (!d?.date || typeof d.value_native !== "number") return null;
    return { title: "PUN medio", rows: [{ label: itDate(d.date), value: formatEuro(d.value_native, d.unit_native ?? "€/MWh", 2) }] };
  }
  if (variant === "psv") {
    const v = body.value_native, day = body.gas_day;
    if (typeof v !== "number" || typeof day !== "string") return null;
    return { title: "PSV giorno gas", rows: [{ label: itDate(day), value: formatEuro(v, String(body.unit_native ?? "€/MWh"), 2) }] };
  }
  // Per le variabili le statistiche sono lo spread sull'indice (PUN/PSV), non un prezzo.
  const indices = body.indices as { slug: string; median: number; unit: string; date: string; basis?: string; reference?: string }[] | undefined;
  if (!Array.isArray(indices) || indices.length === 0) return null;
  const rows = [...indices]
    .sort((a, b) => Number(b.basis !== "spread") - Number(a.basis !== "spread"))
    .map((i) =>
      i.basis === "spread"
        ? { label: "Prezzo variabile", value: `${i.reference ?? "indice"} + ${formatEuro(i.median, i.unit, 3)}` }
        : { label: "Prezzo fisso", value: formatEuro(i.median, i.unit, 3) },
    );
  return { title: variant === "indice-luce" ? "Offerte luce · mediana" : "Offerte gas · mediana", date: itDate(indices[0].date), rows };
}
```

**Step 4:** Run il test. Expected: PASS.

**Step 5: Commit**

```bash
git add lib/widget/core.ts tests/lib/widget-core.test.ts
git commit -m "feat(widget): logica pura (attribuzione, varianti, modello dati)"
```

---

## Task 12: Bundle `widget.js`

**Files:**
- Create: `lib/widget/browser.ts` (entry del bundle)
- Create: `scripts/build-widget.ts`
- Modify: `package.json` (`"prebuild": "tsx scripts/build-widget.ts"`, `esbuild` come devDependency esplicita con la versione già presente in `node_modules/esbuild/package.json`)
- Modify: `.gitignore` (`/public/widget.js`)
- Modify: `netlify.toml` (header di cache per `/widget.js`)

**Step 1: Entry**

```ts
/**
 * Entry di public/widget.js. Per ogni .eidx-widget:
 * 1) senza un link visibile a energyindex.it non chiama l'API e lo dice;
 * 2) altrimenti disegna i valori in uno Shadow DOM su un contenitore figlio,
 *    cosi' lo stile e' isolato e i link dello snippet restano nel DOM.
 */
import { findAttribution, isRenderedVisible, readModel, WIDGET_VARIANTS, type WidgetVariant } from "./core";

const BASE = "https://energyindex.it";
const CSS = `:host{all:initial;display:block;font:14px/1.4 system-ui,-apple-system,sans-serif}
.box{border:1px solid var(--b);border-radius:12px;padding:12px 14px;background:var(--bg);color:var(--fg)}
.t{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin:0 0 6px}
.r{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.v{font-weight:800;font-variant-numeric:tabular-nums}
.e{font-size:12px;opacity:.8}`;
const THEMES = { light: "--bg:#fff;--fg:#0a3d2e;--b:#d6e4dd", dark: "--bg:#0b1512;--fg:#e8f5ee;--b:#1f3a30" };

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

async function mount(root: HTMLElement) {
  if (root.dataset.eidxReady) return;
  root.dataset.eidxReady = "1";
  const variant = root.dataset.eidx as WidgetVariant;
  const def = WIDGET_VARIANTS[variant];
  if (!def) return;

  const host = document.createElement("div");
  root.insertBefore(host, root.firstChild);
  const shadow = host.attachShadow({ mode: "open" });
  const theme = root.dataset.theme === "dark" ? THEMES.dark : THEMES.light;
  const paint = (inner: string) => { shadow.innerHTML = `<style>${CSS}:host{${theme}}</style><div class="box">${inner}</div>`; };

  if (!findAttribution(root, isRenderedVisible)) {
    paint(`<p class="e">Widget disattivato: manca il link di attribuzione a Energy Index.</p>`);
    return;
  }
  try {
    const sep = def.endpoint.includes("?") ? "&" : "?";
    const res = await fetch(`${BASE}${def.endpoint}${sep}src=widget`);
    const model = res.ok ? readModel(variant, await res.json()) : null;
    if (!model) throw new Error("no data");
    paint(`<p class="t">${esc(model.title)}</p>${model.rows.map((r) => `<div class="r"><span>${esc(r.label)}</span><span class="v">${esc(r.value)}</span></div>`).join("")}${model.date ? `<p class="e">Dato del ${esc(model.date)}</p>` : ""}`);
  } catch {
    paint(`<p class="e">Dato momentaneamente non disponibile.</p>`);
  }
}

function init() {
  document.querySelectorAll<HTMLElement>(".eidx-widget").forEach((el) => { void mount(el); });
}

// Dopo "load": la verifica di visibilita' dell'attribuzione deve vedere i fogli
// di stile della pagina applicati, non il layout senza stili di DOMContentLoaded.
const start = () => requestAnimationFrame(init);
if (document.readyState === "complete") start();
else window.addEventListener("load", start, { once: true });
```

**Step 2: Script di build**

```ts
/** Genera public/widget.js (IIFE minificata). Lanciato dal prebuild. */
import { build } from "esbuild";

await build({
  entryPoints: ["lib/widget/browser.ts"],
  outfile: "public/widget.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  legalComments: "none",
  banner: { js: "/* Energy Index widget — https://energyindex.it/it/api/widget */" },
});
console.log("public/widget.js generato");
```

**Step 3: Configurazione**

- `package.json`: `"prebuild": "tsx scripts/build-widget.ts"`.
- `netlify.toml`:

```toml
[[headers]]
  for = "/widget.js"
  [headers.values]
    Cache-Control = "public, max-age=3600, stale-while-revalidate=86400"
    Access-Control-Allow-Origin = "*"
```

**Step 4: Verifica**

```bash
npx tsx scripts/build-widget.ts && wc -c public/widget.js
```

Expected: file sotto 6 KB.

Poi crea `scratchpad/widget-test.html`: due widget con link, uno senza link, uno con link `display:none`. Servilo in locale (in una pagina HTML locale lo script punta a `BASE` di produzione; per provare contro il dev server metti temporaneamente `BASE = ""` e apri la pagina da `http://localhost:<porta>/widget-test.html` copiandola in `public/`, poi rimuovila). Expected: i due widget con link mostrano i valori, gli altri due "Widget disattivato".

**Step 5: Commit**

```bash
git add lib/widget/browser.ts scripts/build-widget.ts package.json package-lock.json .gitignore netlify.toml
git commit -m "feat(widget): bundle public/widget.js generato al prebuild"
```

---

## Task 13: Snippet e configuratore `/it/api/widget`

**Files:**
- Create: `lib/widget/snippet.ts`
- Test: `tests/lib/widget-snippet.test.ts`
- Create: `app/[locale]/api/widget/page.tsx` (server, metadata e SEO) e `components/api/WidgetConfigurator.tsx` (client)

**Step 1: Test dello snippet**

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { buildSnippet } from "@/lib/widget/snippet";
import { hasEnergyIndexLink } from "@/lib/api-keys/link-check";

describe("buildSnippet", () => {
  it("contiene il link di attribuzione nell'HTML statico", () => {
    const s = buildSnippet("indice-luce", "light");
    expect(hasEnergyIndexLink(s)).toBe(true);
    expect(s).toContain('data-eidx="indice-luce"');
    expect(s).toContain('<script src="https://energyindex.it/widget.js" async></script>');
  });
  it("anchor di marca, mai keyword", () => {
    expect(buildSnippet("pun", "light")).toMatch(/>Energy Index<\/a>/);
  });
  it("varianti GME: riga di fonte GME obbligatoria", () => {
    expect(buildSnippet("pun", "dark")).toContain("Gestore dei Mercati Energetici S.p.A.");
    expect(buildSnippet("indice-gas", "dark")).not.toContain("Gestore dei Mercati");
  });
});
```

Run. Expected: FAIL.

**Step 2: Implementazione**

```ts
import { WIDGET_VARIANTS, type WidgetVariant } from "./core";

/** Snippet da incollare. I link stanno nell'HTML statico: Google li vede anche se lo script non gira. */
export function buildSnippet(variant: WidgetVariant, theme: "light" | "dark"): string {
  const def = WIDGET_VARIANTS[variant];
  const source = def.gme
    ? `Fonte: Gestore dei Mercati Energetici S.p.A. — via <a href="https://energyindex.it">Energy Index</a>`
    : `Fonte: <a href="https://energyindex.it">Energy Index</a>`;
  return `<div class="eidx-widget" data-eidx="${variant}" data-theme="${theme}">
  <a href="${def.page}?ref=widget">${def.label}</a>
  <p class="eidx-src">${source}</p>
</div>
<script src="https://energyindex.it/widget.js" async></script>`;
}
```

Run il test. Expected: PASS.

**Step 3: Pagina e configuratore.**
- `page.tsx`: metadata con titolo "Widget prezzi energia gratuito per il tuo sito", canonical `/it/api/widget` e descrizione. Mostra `<WidgetConfigurator />`, sotto le regole d'uso (link visibile; per PUN e PSV le condizioni GME, con link alla sezione licenza della documentazione) e un link al form chiave.
- `WidgetConfigurator.tsx`: select per la variante (4 opzioni, con le varianti dei nostri indici prima), toggle tema, anteprima live (inietta lo snippet in un contenitore e carica `/widget.js` una volta con `next/script` `strategy="afterInteractive"`; al cambio variante rimonta il contenitore con una `key`), `<pre>` con lo snippet e pulsante "Copia codice" (`navigator.clipboard.writeText`), più `trackEvent("widget_snippet_copy", { variant })` (vedi `lib/analytics`).
- Sostituisci in `app/[locale]/api/page.tsx` (circa riga 577) lo snippet finto `data-eidx-widget="today"` con `buildSnippet("indice-luce", "light")` e un link "Configura il widget" verso `/it/api/widget`.
- Aggiungi `/it/api/widget` alla sitemap: cerca in `app/sitemap.ts` dove è elencato `/it/api` e aggiungi la voce accanto.

**Step 4: Verifica.** `npx tsc --noEmit -p .`, poi apri `/it/api/widget` nel dev server: l'anteprima mostra i valori, la copia funziona e la console non ha errori. Fai uno screenshot.

**Step 5: Commit**

```bash
git add lib/widget/snippet.ts tests/lib/widget-snippet.test.ts "app/[locale]/api/widget/page.tsx" components/api/WidgetConfigurator.tsx "app/[locale]/api/page.tsx" app/sitemap.ts
git commit -m "feat(widget): configuratore /it/api/widget e snippet con attribuzione"
```

---

## Task 14: Vista admin "Integrazioni"

**Files:**
- Modify: `lib/admin/queries.ts` (aggiungi `listApiKeys()`, `widgetDomains(days)`, `keylessApiDomains(days)`)
- Create: `app/actions/admin-api-keys.ts` (`revokeApiKey(id)`, `recheckApiKeyLink(id)`, entrambe con `requireAdmin()`)
- Modify: `app/[locale]/admin/(dash)/page.tsx` (nuova voce in `TABS`: `{ id: "integrazioni", label: "Integrazioni", icon: KeyRound }` e componente `IntegrationsTab`)

**Step 1: Query.** Stesso stile `Result<T>` delle funzioni esistenti in `lib/admin/queries.ts`:
- `listApiKeys`: `api_keys` con le colonne `id, prefix, email, nome, domain, attribution_url, plan, status, link_ok, link_checked_at, link_failures, created_at, activated_at`, ordinate per `created_at desc`;
- `widgetDomains(days)`: righe di `traffic_log` con `kind='api'`, `query ilike '%src=widget%'` e `ts` negli ultimi `days` giorni, raggruppate per `origin_host`. Se il raggruppamento lato client pesa troppo, crea la RPC `admin_widget_domains(days int)` in una migrazione `20261031000002_admin_widget_domains.sql` (SECURITY DEFINER, `REVOKE` da anon/authenticated) che restituisce `origin_host, requests, first_seen, last_seen`;
- `keylessApiDomains(days)`: come sopra con `api_key_prefix is null`, `origin_host is not null`, escluso `src=widget`.

**Step 2: Azioni.**
- `revokeApiKey`: imposta `status='revoked'` e `revoked_at=now()`. Il middleware se ne accorge entro 60 s, per la cache.
- `recheckApiKeyLink`: usa `fetchHasLink` e `nextLinkState` e aggiorna la riga. Ogni azione chiama `revalidatePath("/it/admin")`.

**Step 3: UI.** `IntegrationsTab` con tre `Panel` (stesso componente usato dalle altre schede):
- chiavi: stato colorato, link ok/ko con data, pulsanti Revoca/Ricontrolla;
- domini widget;
- domini senza chiave (lead).

**Step 4: Verifica.** Login admin in locale, apri `/it/admin?tab=integrazioni`: compare la chiave di prova del Task 9. Revocala e controlla che un `curl` con quella chiave risponda 401 entro un minuto.

**Step 5: Commit**

```bash
git add lib/admin/queries.ts app/actions/admin-api-keys.ts "app/[locale]/admin/(dash)/page.tsx"
git commit -m "feat(admin): scheda Integrazioni con chiavi, domini widget e lead"
```

---

## Task 15: Documentazione e testi pubblici

**Files:**
- Modify: `app/[locale]/api/docs/page.tsx`: sezioni Autenticazione (Bearer, `?key=` sconsigliato, vincolo Origin, 401/403), Limiti (quote applicate, finestra di 5 minuti, 429 + `Retry-After`, `X-EIDX-Key-Status`, `X-EIDX-Notice`), Licenza (verifica settimanale del link, qualsiasi `rel`, declassamento dopo 2 verifiche fallite), nuova sezione Widget con link al configuratore, voce di changelog `2026-10-31`. Rimuovi gli header d'esempio che non esistono (`X-RateLimit-Remaining`, `X-Quota-Remaining`).
- Modify: `app/api/v1/route.ts`: `rate_limit` coerente ("60/min per IP; con chiave il limite del piano; quote calcolate su finestre di 5 minuti"), `auth: "Authorization: Bearer eidx_live_…"`, voce `/api/v1/energy-index` e `widget: "https://energyindex.it/it/api/widget"`.
- Modify: `app/llms.txt/route.ts`: riga sul widget e su `/api/v1/energy-index`.
- Modify: `components/api/ApiKeyRequestForm.tsx`: il testo "entro 2 giorni lavorativi" resta solo per i piani manuali (fatto nel Task 9, ricontrolla).
- Modify: `app/[locale]/api/page.tsx`: il pannello accanto al form (sezione `#chiave`) dice ancora "Risposta entro 2 giorni lavorativi" / "ti contattiamo". Per Developer ora la chiave è immediata dopo la conferma email: riscrivi il pannello distinguendo Developer (self-service, link di attribuzione verificato ogni settimana) dai piani a pagamento (su richiesta).

**Step 1:** Applica le modifiche.

**Step 2:** Run `npx tsc --noEmit -p . && npx vitest run`. Expected: tutto verde.

**Step 3:** Apri `/it/api/docs` nel dev server e controlla le sezioni toccate, con screenshot.

**Step 4: Commit**

```bash
git add "app/[locale]/api/docs/page.tsx" app/api/v1/route.ts app/llms.txt/route.ts components/api/ApiKeyRequestForm.tsx
git commit -m "docs(api): autenticazione, quote, widget e licenza allineati al comportamento reale"
```

---

## Task 16: Verifica finale e consegna

**Step 1:** Run `npx vitest run && npx tsc --noEmit -p . && npx eslint lib/api-keys lib/widget lib/api app/api middleware.ts scripts/check-attribution-links.ts scripts/build-widget.ts`. Expected: tutto verde.

**Step 2:** Run `npm run build`. Expected: build ok, `public/widget.js` generato dal prebuild.

**Step 3: Checklist manuale in locale**
- [ ] `/api/v1/pun/today` senza chiave → 200 con `X-RateLimit-Limit: 60`
- [ ] chiave falsa → 401; chiave vera con Origin sbagliato → 403; chiave vera senza Origin → 200
- [ ] `/api/v1/energy-index` → 4 indici
- [ ] widget con link → valori; widget senza link o nascosto → "disattivato"
- [ ] form Developer → email → attivazione → chiave funzionante
- [ ] admin Integrazioni → chiave visibile, revoca → 401
- [ ] `SELECT refresh_api_throttle()` gira; `cron.job` contiene `api-throttle-refresh`

**Step 4:** Revoca o cancella le righe di prova in `api_keys`, dopo averle mostrate al titolare.

**Step 5:** Usa la skill superpowers:finishing-a-development-branch. Push e merge su `main` solo con l'ok del titolare. Dopo il deploy, verifica in produzione con `curl` gli stessi punti della checklist e che `https://energyindex.it/widget.js` risponda 200 con l'header di cache.

**Step 6:** Aggiorna la memoria di progetto (`gme-licenza-dati.md` o una nuova `api-chiavi-widget.md`) con lo stato: cosa è live, i secret necessari nel repo e i limiti noti (quote morbide, pagine renderizzate solo lato client).
