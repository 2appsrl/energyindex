# Go-live: widget, chiavi API e quote

Checklist per il titolare, in ordine. Contesto: `docs/plans/2026-10-31-widget-chiavi-dominio-design.md`.

## 1. Chiavi date a mano

Dopo il deploy ogni token che inizia con `eidx_live_` e non è in `api_keys` riceve **401**. Prima di andare live:

- [ ] Cerca nella posta inviata `eidx_live_`: nessuna chiave deve essere stata consegnata fuori dal DB. Per quelle che trovi, inseriscile con il modello qui sotto (stessa chiave, così il cliente non deve cambiare nulla).
- [ ] Controlla cosa c'è già: `select prefix, plan, status, email, domain, created_at from api_keys order by created_at;`

Chiave a pagamento rilasciata a mano. Genera chiave, prefisso e hash in locale (stesso alfabeto di `generateApiKey`; la chiave in chiaro non passa dal DB né dalla cronologia dell'SQL Editor):

```bash
node -e 'const c=require("crypto"),A="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";let s="";while(s.length<32)for(const b of c.randomBytes(48))if(b<248&&s.length<32)s+=A[b%62];const k="eidx_live_"+s;console.log(k);console.log(k.slice(0,14));console.log(c.createHash("sha256").update(k).digest("hex"))'
```

Per una chiave già esistente: `node -e 'const k=process.argv[1];console.log(k.slice(0,14));console.log(require("crypto").createHash("sha256").update(k).digest("hex"))' 'eidx_live_...'`

```sql
-- domain: minuscolo, senza https:// e senza www. (vale anche per i sottodomini)
-- plan: api | pro | trading | enterprise
insert into api_keys (email, nome, azienda, progetto, plan, domain, attribution_url,
                      status, prefix, key_hash, activated_at)
values (lower('<email>'), '<nome>', '<azienda>', '<note contratto>', '<plan>',
        '<dominio.it>', 'https://<dominio.it>/',
        'active', '<prefisso 14 caratteri>', '<sha256 hex>', now());
```

In alternativa l'hash si calcola nel DB con pgcrypto (su Supabase sta nello schema `extensions`; verifica con `select extnamespace::regnamespace from pg_extension where extname = 'pgcrypto';`): `left('<chiave>', 14)` e `encode(extensions.digest('<chiave>', 'sha256'), 'hex')`. Così però la chiave resta nella cronologia dell'SQL Editor.

## 2. Migrazioni

Nell'SQL Editor di Supabase, in quest'ordine:

1. [ ] `20260927000001_admin_traffic_leads.sql`: solo se `select to_regclass('public.traffic_log');` restituisce null.
2. [ ] `20261031000001_api_keys_throttle.sql`
3. [ ] `20261031000002_admin_integrations.sql`

Verifiche:

```sql
select jobname, schedule, active from cron.job
where jobname in ('traffic-log-retention', 'api-throttle-refresh');   -- 2 righe, active = true
select refresh_api_throttle();                                       -- un numero, nessun errore
select count(*) from api_keys;                                       -- la tabella esiste
select * from admin_widget_domains(30) limit 5;                      -- la RPC risponde
```

## 3. Quote in sola osservazione

Finché la variabile Netlify `API_THROTTLE_ENFORCE` non vale `1` il middleware non manda 429: chi è oltre quota passa con l'header `X-EIDX-Throttle: observe`. Chiave e Origin (401/403) valgono da subito.

- [ ] TODO: la sezione "Limiti" di `/it/api/docs` descrive già il 429. Finché il flag è spento la pagina promette più di quanto applichiamo: attivare il flag entro poche settimane dal deploy.

Query per il periodo di osservazione (1-2 settimane):

```sql
-- Chi chiama di piu' (ultimi 7 giorni)
select agent, agent_kind, count(*) as richieste, count(distinct ip_hash) as ip
from traffic_log where kind = 'api' and ts > now() - interval '7 days'
group by 1, 2 order by 3 desc limit 20;

-- IP che in una finestra di 5 minuti superano la soglia Open (5 x 60 = 300)
select ip_hash, agent, date_bin('5 minutes', ts, '2026-01-01') as finestra, count(*)
from traffic_log
where kind = 'api' and ts > now() - interval '7 days' and api_key_prefix is null
group by 1, 2, 3 having count(*) > 300 order by 4 desc limit 50;

-- Soggetti in throttle adesso (le righe scadute si cancellano a ogni refresh)
select * from api_throttle order by until desc;
```

- [ ] Attiva `API_THROTTLE_ENFORCE=1` (Netlify, Site configuration → Environment variables) e rifai il deploy quando in `api_throttle` e nella seconda query compaiono solo bot o abusi, non integrazioni legittime (per esempio un'azienda con molti utenti dietro lo stesso IP: in quel caso proponi una chiave prima di attivare).
- [ ] Dopo l'attivazione: un soggetto in `api_throttle` riceve 429 con `Retry-After: 900`.

## 4. Segreti

Netlify:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` (senza, il middleware lascia passare tutto e non scrive il log)
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_SENDER_EMAIL` con un dominio verificato in Resend, es. `EIDX Pro <api@energyindex.it>`. Il valore di default `onboarding@resend.dev` consegna solo all'indirizzo del titolare dell'account Resend: gli utenti non riceverebbero il link di verifica.

GitHub (Settings → Secrets → Actions), per il workflow "Verifica link attribuzione chiavi API":

- [ ] `RESEND_API_KEY`, `RESEND_SENDER_EMAIL` (senza, ogni email necessaria fa fallire il workflow con un `::warning::`)
- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (già usati dagli altri workflow: verifica che ci siano)

## 5. Deploy e smoke test

Dopo il deploy, con `B=https://energyindex.it`:

- [ ] `curl -sI $B/widget.js` → 200 e `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`
- [ ] `curl -sI $B/api/v1/pun/today` → 200 e `X-RateLimit-Limit: 60`
- [ ] `curl -sI -H "Authorization: Bearer abc123" $B/api/v1/pun/today` → 200 (Bearer non nostro = anonimo)
- [ ] `curl -sI -H "Authorization: Bearer eidx_live_x" $B/api/v1/pun/today` → 401
- [ ] Flusso Developer completo: form su `/it/api`, email di verifica, "Attiva la chiave", email con la chiave; poi `curl -sI -H "Authorization: Bearer <chiave>" $B/api/v1/pun/today` → 200, `X-RateLimit-Limit: 120`, `X-EIDX-Key-Status: active` (entro un minuto dall'attivazione)
- [ ] Stessa chiave con `-H "Origin: https://altro-sito.example"` → 403 `origin_not_allowed`
- [ ] `/it/admin?tab=integrazioni`: la chiave di prova compare, widget e domini senza chiave si caricano
- [ ] Revoca la chiave di prova dall'admin → 401 entro circa 60 s (cache del middleware)
- [ ] GitHub → Actions → "Verifica link attribuzione chiavi API" → Run workflow (workflow_dispatch): esce verde e il riepilogo JSON ha `errors: 0`
- [ ] Log di Netlify (Edge Functions): nessuna riga `[api-keys]`. "tabella ... mancante" vuol dire migrazione 2 non applicata, "configurazione (service key ...)" vuol dire `SUPABASE_SERVICE_ROLE_KEY` errata.

## 6. Dipendenza: aggregati ARERA

`energy_index_aggregates` è fermo al 2026-10-14: lo aggiorna il job `arera-placet` di `deploy/energiapro-cron`, che aspetta ancora il server (vedi il README della cartella). Finché non gira, `/api/v1/energy-index`, la home e `/it/mercato-libero` mostrano valori di quella data.

- [ ] Configura il server, lancia `./run-etl.sh arera-placet` e verifica `select max(computed_at) from energy_index_aggregates;`.
