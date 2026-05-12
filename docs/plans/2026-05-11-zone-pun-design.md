# Slice 3 — Zone PUN + Mappa Italia

**Data:** 2026-05-11
**Scope:** UI per esplorare le 6 zone fisiche del PUN (NORD/CNOR/CSUD/SUD/SICI/SARD) sulla pagina `/it/indice/pun`.

## 1. Obiettivo

Sbloccare i dati zonali PUN già presenti in DB (6 asset × ~44k ore each = ~264k osservazioni). Aggiungere un selettore visuale (mappa SVG Italia + pill row testuale) alla pagina PUN, con URL param `?zone=<code>` per deep-linking.

## 2. Stato attuale (verificato)

| asset_id | slug | display_name_it | obs |
|---|---|---|---|
| 1 | pun | PUN — Prezzo Unico Nazionale | 43.939 |
| 2 | pun-zona-nord | PUN Zona Nord | 43.939 |
| 3 | pun-zona-cnor | PUN Zona Centro-Nord | 43.939 |
| 4 | pun-zona-csud | PUN Zona Centro-Sud | 43.939 |
| 5 | pun-zona-sud | PUN Zona Sud | 43.939 |
| 6 | pun-zona-sici | PUN Zona Sicilia | 43.939 |
| 7 | pun-zona-sard | PUN Zona Sardegna | 43.939 |

Tutti popolati 5Y, ETL daily già attivo (Slice 1.5). RPC `get_price_series` asset-agnostic (Slice 2). **Zero nuovi dati, zero migrazioni, zero ETL.**

## 3. URL e routing

Pagina sola: `/it/indice/pun?zone=<code>`

- `code` ∈ `nord | cnor | csud | sud | sici | sard`
- Nessun param = nazionale (default)
- Param invalido (es. `?zone=foo`) → fallback silente a nazionale (stesso pattern di `resolveTimeframe`)
- Combinazione libera con `?tf=` (es. `?zone=nord&tf=1Y`)

## 4. Layout pagina

```
[Header "PUN — Prezzo Unico Nazionale"]
[Description statica]
[LatestValueCard]               ← prezzo della zona attiva (es. "PUN Zona Nord 152,38 €/MWh")
[Mappa Italia SVG]              ← NOVITÀ — click su zona per cambiare
[Pill row Nazionale | Nord | ...]  ← NOVITÀ — selettore testuale a11y/mobile
[Chart heading dinamico + TimeframeSelector]
[Chart]
[FAQ]
[CTA]
```

Mappa e pill row sono **sincronizzate** sullo stesso `?zone=` — UI doppia per redundancy (mappa = scoperta visuale, pill = a11y + mobile + screen reader).

## 5. Mappa SVG

Disegno stilizzato (non precisione geografica). Approccio:
- viewBox unico (es. 200×300) con sagoma Italia + 2 isole
- 6 `<path>` clickabili, uno per zona, con `data-zone` attribute
- Wrapped in `<Link href="/it/indice/pun?zone=...&tf=<current>">` per ogni zona
- Active zone: `fill: var(--color-primary)`, altre: `fill: var(--color-muted)`
- Hover su non-active: bordo primary

Forma approssimata:
- **NORD**: rettangolo top (Lombardia/Piemonte/Veneto/Emilia)
- **CNOR**: fascia sotto Nord (Toscana/Umbria/Marche)
- **CSUD**: fascia centro-sud (Lazio/Abruzzo/Campania/Puglia/Basilicata)
- **SUD**: punta dello stivale (Calabria + bottom Puglia)
- **SICI**: ovale a sud-ovest
- **SARD**: ovale a ovest

Path SVG scritti a mano (semplificati), non importati da GeoJSON — semplicità > precisione.

Responsivo: viewBox preserva aspect ratio. Su mobile, max-width: 200px o simili.

## 6. Pill row testuale

Component `ZoneSelector` simile a `TimeframeSelector`. 7 pill in fila:

```
[Nazionale] [Nord] [C-Nord] [C-Sud] [Sud] [Sicilia] [Sardegna]
```

- Active pill: `bg-primary text-primary-foreground`
- Mobile: `overflow-x-auto` per scroll orizzontale
- Click → `<Link href="?zone=...&tf=<current>">`
- `aria-current="page"` su attivo, `aria-label="Zona PUN"` sul wrapper

## 7. Backend (zero migrazioni)

- `app/[locale]/indice/[slug]/page.tsx` aggiunge:
  - `searchParams.zone?: string`
  - Helper `resolveZone(zoneParam): { code, displayName, slug, isNational }`
  - Quando slug='pun' e zone != null, usa `slug` zonale invece di 'pun' per la query
- `SUPPORTED_SLUGS` resta `['pun', 'psv']` — le zone NON sono URL distinte, sono modifier di `pun`
- Le slug zonali in DB (pun-zona-*) sono solo identifier interni — l'URL pubblica resta `/it/indice/pun`

## 8. Files toccati

**Nuovi**:
- `lib/pun-zones.ts` — mapping `ZoneCode → { slug, displayName, displayShort }` + `resolveZone()`
- `components/chart/ZoneSelector.tsx` — pill row
- `components/chart/ZoneMapItalia.tsx` — SVG mappa cliccabile

**Modificati**:
- `app/[locale]/indice/[slug]/page.tsx` — `searchParams.zone`, resolveZone, asset_id derivato, render mappa + selector

## 9. Out of scope

- Confronto cross-zone in un unico chart
- Spread "vs nazionale" come overlay
- Pagine separate per zona (URL canoniche `/it/indice/pun-zona-nord`)
- Mappa con confini regionali precisi (GeoJSON)
- Tooltip con prezzo live al hover sulla mappa
- Sostituire FAQ con varianti zonali

## 10. Rischi

- **Mobile UX della mappa**: SVG di 200px di larghezza potrebbe risultare piccolo. Mitigazione: pill row sotto la mappa garantisce navigabilità anche se la mappa non è tappabile bene.
- **Active zone illeggibile**: il fill primary su zona piccola (Sicilia/Sardegna) potrebbe perdere il label. Mitigazione: ogni zona ha un `<text>` sopra con il codice (NORD/SICI/etc.).
- **SEO**: Google indicizzerà gli URL con `?zone=`? Sì, ma con priorità più bassa della canonica. Aggiungere `<link rel="canonical">` alla versione nazionale per evitare duplicati. Mitigazione: oppure non aggiungere canonical e accettare che ogni zona sia una variante indicizzabile.
