# Widget embeddabile e chiavi API legate al dominio — Design

Data: 2026-10-31 · Stato: approvato dal titolare

## Obiettivo

Fare in modo che ogni uso delle API porti a Energy Index traffico di
referral, citazioni del marchio e autorità, in modo sicuro e senza dipendere
dalla buona volontà di chi integra i dati. Oggi l'attribuzione è affidata
all'utente, le chiavi si emettono a mano via email, e il limite di 60
richieste al minuto è scritto nella documentazione ma non è applicato.

## Vincoli

- **Licenza GME.** Energy Index non ha accordi con il GME (vedi la memoria
  `gme-licenza-dati`). Il prodotto di punta sono quindi i nostri indici delle
  offerte, calcolati sui dati ARERA. PUN e PSV restano disponibili come
  variante, con citazione GME obbligatoria e uso informativo dichiarato.
- **Policy di Google sul link spam.** Google considera spam i link nei
  widget distribuiti su molti siti, se sono ricchi di parole chiave o
  imposti in cambio di qualcosa. Quindi:
  - l'anchor è di marca ("Fonte: Energy Index"), mai di parole chiave;
  - chiediamo un link visibile, non un link dofollow. Accettiamo qualsiasi
    `rel`.
- **Cache CDN.** Le risposte `/api/v1/*` hanno `s-maxage=900`. Il middleware
  gira prima della cache, quindi chiavi e quote si controllano lì. La
  chiave viaggia nell'header `Authorization`: in querystring spezzerebbe la
  cache.
- **Licenza dati ARERA**: da verificare prima di promuovere gli indici "anche
  per uso commerciale".

## Componenti

### 1. Endpoint `/api/v1/energy-index` (oggi "coming")

Legge l'ultimo snapshot di `energy_index_aggregates`, cioè una riga per
ciascuno dei 4 slug `mercato-libero-*`. Il contratto del catalogo va
allineato allo schema reale: non c'è `mean`. Campi per indice:

| Campo | Contenuto |
|---|---|
| `slug`, `name`, `unit` | identificativo, nome e unità |
| `median`, `p25`, `p75`, `min`, `max` | statistiche del prezzo |
| `offers` | dimensione del campione (`sample_size`) |
| `spread_vs_reference_pct` | presente solo per le variabili |
| `date` | data dello snapshot (`computed_at`) |
| `page` | pagina dell'indice su energyindex.it |

Altri dettagli:
- filtro opzionale `commodity=luce|gas`;
- `attribution` = "Fonte: Energy Index (https://energyindex.it) — elaborazione su dati Portale Offerte ARERA";
- cache 6 ore; piano Open.

### 2. `widget.js` e configuratore `/it/api/widget`

**Snippet** generato dal configuratore, che permette di scegliere indice,
tema chiaro/scuro e formato compatto/esteso:

```html
<div class="eidx-widget" data-eidx="indice-luce" data-theme="light">
  <a href="https://energyindex.it/it/mercato-libero">Energy Index · Luce</a>
  <p class="eidx-src">Fonte: <a href="https://energyindex.it">Energy Index</a></p>
</div>
<script src="https://energyindex.it/widget.js" async></script>
```

**Varianti**:
- `indice-luce` e `indice-gas`: le mediane dei nostri indici fisso e
  variabile;
- `pun`: `daily_average` di `/pun/today`;
- `psv`: il giorno gas di `/psv/today`.

Per `pun` e `psv` lo snippet contiene anche, nell'HTML statico, la riga
"Dati: Gestore dei Mercati Energetici S.p.A.".

**Script** (`app/widget.js/route.ts`, JS vanilla, meno di 5 KB minificato,
cache 1 giorno):
1. trova gli elementi `.eidx-widget`;
2. controlla che esista un `<a>` verso `https://energyindex.it` con testo
   non vuoto e visibile (`offsetParent`, `display`, `visibility`, `opacity`,
   dimensioni > 0);
3. se il controllo fallisce, mostra "Widget disattivato: manca
   l'attribuzione a Energy Index" e non chiama l'API;
4. altrimenti chiama l'endpoint e disegna i valori in uno Shadow DOM
   agganciato a un contenitore figlio, così lo stile resta isolato e i
   link restano nel DOM visibile;
5. aggiunge `?ref=widget` solo al link della pagina indice. Su quelle
   pagine il canonical è già impostato e neutralizza il parametro. Il link
   "Fonte" resta pulito.

**Logica pura** (verifica dell'attribuzione, formattazione dei valori,
scelta dell'endpoint) in `lib/widget/core.ts`, testata con vitest e jsdom.
Il bundle viene generato con esbuild in `public/` oppure servito dalla
route.

**Il widget non chiede chiave**: è la scelta per la massima adozione. Il
dominio che lo ospita arriva comunque in `traffic_log.origin_host`.

**Configuratore**: anteprima dal vivo, pulsante "copia codice" e una nota
sulle condizioni d'uso GME per le varianti PUN e PSV.

### 3. Chiavi legate al dominio

**Tabella `api_keys`** (RLS attiva, nessuna policy pubblica, accesso solo
con la service role):

```
id uuid pk, prefix text unique,           -- "eidx_live_ab12" (14 caratteri, come apiKeyPrefix)
key_hash text unique,                     -- sha256 hex della chiave completa
email text, nome text, azienda text, plan text default 'developer',
domain text,                              -- host normalizzato (senza www.)
attribution_url text,                     -- pagina dove compare il link
status text check in ('pending','active','downgraded','revoked'),
verify_token_hash text, verify_expires_at timestamptz,
link_checked_at timestamptz, link_ok boolean, link_failures int default 0,
created_at, activated_at, last_used_at, lead_id bigint
```

**Formato della chiave**: `eidx_live_` più 32 caratteri base62 da
`crypto.getRandomValues`. Il DB conserva solo l'hash. La chiave completa
si vede una sola volta: nella pagina di conferma e nell'email.

**Rilascio self-service**, che sostituisce l'emissione manuale:
1. Il form `/it/api#chiave` chiede nome, email, azienda, dominio, URL della
   pagina con l'attribuzione e progetto. Si crea la riga `pending`, il token
   viene salvato come hash con scadenza a 24 ore, e Resend manda il link
   `/it/api/chiave/verifica?t=…`.
2. Al clic si verifica il token, si genera la chiave, la riga diventa
   `active` e la chiave viene mostrata e mandata per email. Il lead resta
   salvato in `leads` come oggi.
3. Se il link nella pagina dichiarata manca già al rilascio, la chiave
   viene creata lo stesso. Un avviso indica che va aggiunto entro la prima
   verifica.
4. I piani a pagamento (API, Pro, Enterprise) restano su richiesta
   manuale, come oggi.

**Uso della chiave**: header `Authorization: Bearer eidx_live_…`.
- La querystring `?key=` resta accettata per compatibilità, ma la
  documentazione la sconsiglia.
- Se la richiesta ha un header `Origin`, il suo host deve essere `domain`
  o un suo sottodominio; altrimenti la risposta è `403 origin_not_allowed`.
- Le chiamate server-to-server, senza `Origin`, sono ammesse.

**Verifica settimanale del link** (`scripts/check-attribution-links.ts`,
GitHub Action ogni lunedì):
1. per ogni chiave `active` o `downgraded` scarica `attribution_url` con
   timeout di 10 s, user-agent `EnergyIndexLinkCheck/1.0` e massimo 3
   redirect;
2. cerca nell'HTML un `<a href>` verso `energyindex.it`, con qualsiasi
   `rel` (parser in `lib/api-keys/link-check.ts`, testato su fixture);
3. se il link c'è: `link_failures` torna a 0 e una chiave `downgraded`
   torna `active`;
4. se manca: `link_failures` aumenta di 1. Alla seconda verifica fallita
   la chiave diventa `downgraded` e parte un'email automatica con le
   istruzioni.
5. In ogni caso aggiorna `link_checked_at` e `link_ok`.

Limite noto: le pagine renderizzate solo lato client non mostrano il link
nell'HTML. In quel caso la chiave non viene declassata se `traffic_log`
registra chiamate del widget da quel dominio: il widget infatti si rifiuta
di funzionare senza link.

### 4. Middleware: chiave e quote

**Controllo della chiave** in `middleware.ts`, sul ramo `/api/v1`:
- si estrae la chiave e si calcola lo SHA-256 con WebCrypto;
- si fa la lookup con una cache in memoria per istanza (TTL 60 s) e il
  fallback a PostgREST con la service role, nello stesso schema di
  `lib/traffic/log.ts`;
- chiave sconosciuta o revocata: `401 invalid_key`;
- chiave `downgraded`: vale come anonima, con limiti Open, e la risposta
  porta l'header `X-EIDX-Notice: attribution-missing`.
- Gli endpoint con tier `developer` (quando saranno attivi) richiedono una
  chiave `active`.

**Quote calcolate dal log** (approccio A, scelto):
- una RPC `refresh_api_throttle()`, lanciata da pg_cron ogni 5 minuti,
  conta le righe di `traffic_log` degli ultimi 5 minuti per
  `api_key_prefix` e per `ip_hash`, raggruppate per `consumer`;
- chi supera le soglie entra in `api_throttle(subject, until)`, con un
  blocco di 15 minuti;
- il middleware legge `api_throttle` con cache di 60 s e risponde `429`
  con `Retry-After`.
- Soglie, uguali a quelle della documentazione: Open 60/min per IP,
  Developer 600/min per chiave.

Il limite è "morbido": chi sfora può passare per qualche minuto, ma il
costo è zero latenza e nessun nuovo fornitore. Se arrivano abusi si passa a
Upstash (approccio B) senza cambiare il contratto.

**Header in risposta**: `X-RateLimit-Limit`, più `X-EIDX-Key-Status` se la
chiave c'è. Niente `Remaining` esatto, perché il conteggio è asincrono.

### 5. Vista admin "Integrazioni"

Una nuova sezione dell'admin esistente, con tre tabelle:
- **chiavi**: prefisso, email, dominio, stato, ultimo controllo del link,
  chiamate negli ultimi 30 giorni;
- **domini che usano il widget**: `origin_host` da `traffic_log` con
  path `/api/v1/*` e chiamate fatte dal widget;
- **domini senza chiave** che chiamano le API: sono potenziali lead.

Azioni: revocare una chiave, rilanciare la verifica del link, segnare il
lead come contattato.

## Documentazione da aggiornare

- `/it/api/docs`: le sezioni Autenticazione, Limiti e Licenza descrivono il
  comportamento reale (Bearer, vincolo sull'Origin, quote, declassamento),
  più una nuova sezione Widget e una voce di changelog.
- Indice `/api/v1`: `rate_limit` diventa coerente con la documentazione.
- Catalogo: `/energy-index` passa a `live`, con il contratto riallineato.

## Fuori scope (fase 2)

- Storico per il piano Developer, partendo dai nostri indici. Lo storico
  GME aspetta la licenza.
- Rate limit rigoroso su Redis.
- Dashboard self-service per l'utente (rotazione chiave, statistiche).
- Rilascio automatico dei piani a pagamento con pagamento integrato.

## Test

- Unit:
  - generazione e hash della chiave, normalizzazione del dominio e
    confronto con l'Origin (inclusi i sottodomini);
  - parser dei link;
  - verifica dell'attribuzione del widget (link presente, nascosto,
    rimosso, anchor vuota);
  - serializer di `/energy-index`;
  - logica delle soglie.
- Integrazione: route di verifica del token (valido, scaduto, già usato).
- Manuale in locale: snippet su una pagina HTML di test, variante senza
  link, chiave con Origin sbagliato (403) e chiamata server senza Origin
  (200).
