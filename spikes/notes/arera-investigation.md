# ARERA Portale Offerte — investigazione accessibilita bulk

**Data:** 2026-05-01
**Contesto:** Task 4 / Fase 0 spike. Scopo: capire SE e COME un processo automatizzato puo
scaricare periodicamente (settimanale e sufficiente) un dump completo delle offerte attive
sul Portale Offerte ARERA, senza autenticazione, per calcolare aggregati Energy Index.

---

## TL;DR — VERDETTO

**Caso A (bulk pubblico) confermato.**

Il Portale Offerte espone, sotto la sezione "Trasparenza > Open Data", una pagina
(<https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page>) con link diretti a
file CSV/XML. I file sono pubblicati su URL stabili con pattern deterministico
`/portaleOfferte/resources/opendata/csv/{kind}/{YYYY}_{M}/PO_{file}_{YYYYMMDD}.{csv|xml}`,
ricostruibili senza scraping HTML, e vengono **rigenerati ogni notte** (Last-Modified
osservato: ogni giorno tra 22:30 e 23:05 UTC). I dati sono dichiarati esplicitamente
"open" sia nella pagina open-data sia tramite il `<meta description>` della stessa.

Per Energy Index: i 4 file PLACET (Offerte E + G, Parametri E + G) sono sufficienti per i
4 aggregati di base (Fisse/Variabili Luce, Fisse/Variabili Gas) e pesano in totale
< 1 MB. I 3 file Mercato Libero (E/G/Dual) coprono il mercato libero completo per
~30 MB / settimana — gestibile.

---

## Candidati indagati (tutti via curl con UA `EnergyIndex-Spike/0.1`)

| # | URL | HTTP | Esito |
|---|---|---|---|
| 1 | `https://www.ilportaleofferte.it/portaleOfferte/` | 200 | Homepage. Trovato link `/it/open-data.page` nel menu "Trasparenza" |
| 2 | `https://www.ilportaleofferte.it/portaleOfferte/static/contenuti/datiOfferte.html` | 404 | URL ipotizzato dal piano: non esiste |
| 3 | `https://www.ilportaleofferte.it/portaleOfferte/it/ricerca-offerte.page` | 200 -> redirect a notfound.page | URL ipotizzato dal piano: non esiste |
| 4 | `https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page` | 200 | **Sezione open-data ufficiale** |
| 5 | `https://www.ilportaleofferte.it/portaleOfferte/resources/cms/documents/fe9833ce8870cb2e146cce5cafe3e7df.csv` | 200 | "Prezzi storici - indici a pubblica diffusione" — CSV mensile (PUN, PSV, PE, CMEM, Pfor, Psbil) — Last-Modified 2026-04-15 |
| 6 | `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerte/2026_5/PO_Offerte_E_PLACET_20260501.csv` | 200 | **Offerte PLACET elettrico, snapshot del giorno** — 909 offerte, 347 KB, Last-Modified 2026-04-30 22:30 UTC |
| 7 | `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerte/2026_5/PO_Offerte_G_PLACET_20260501.csv` | 200 | **Offerte PLACET gas** — 1184 offerte, 485 KB |
| 8 | `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/parametri/2026_5/PO_Parametri_E_20260501.csv` | 200 | Parametri (accise, oneri, bonus) elettrico — 9.9 KB |
| 9 | `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/parametri/2026_5/PO_Parametri_G_20260501.csv` | 200 | Parametri gas — 6.6 KB |
| 10 | `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/2026_5/PO_Offerte_E_MLIBERO_20260501.xml` | 200 | **Mercato Libero elettrico XML** — 18.2 MB, schema `acquirenteunico.it/.../OffertaRetail/01` |
| 11 | `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/2026_5/PO_Offerte_G_MLIBERO_20260501.xml` | 200 | Mercato Libero gas — 10.5 MB |
| 12 | `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/2026_5/PO_Offerte_D_MLIBERO_20260501.xml` | 200 | Mercato Libero dual fuel — 116 KB, 33 offerte |
| 13 | `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerte/2026_4/PO_Offerte_E_PLACET_20260430.csv` | 200 | **Pattern URL stabile**: stesso file per data passata (mese diverso) — verificato anche 2026-04-15, 2026-04-01, 2026-03-01 (tutti 200) |
| 14 | `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerte/2026_5/PO_Offerte_E_PLACET_20260430.csv` | 404 | Conferma: il path mese DEVE corrispondere al mese della data nel filename, non al mese corrente |
| 15 | `https://www.ilportaleofferte.it/portaleOfferte/it/informazioni-legali.page` | 200 | Riportato sotto in "Aspetti legali" |
| 16 | `https://www.dati.gov.it/cercaDataset?q=portale+offerte+arera` | 200 | Pagina raggiungibile ma non investigata in dettaglio: la sorgente primaria su portaleofferte.it e gia sufficiente e canonica |
| 17 | `https://www.arera.it/` | non testato | non necessario: portaleofferte.it espone gia tutti i dati operativi necessari |

URL `static/contenuti/datiOfferte.html` e `it/ricerca-offerte.page` ipotizzati dal piano
non esistono — vanno rimossi dal plan-of-record (analoghi alle URL fantasma trovate per GME).

---

## Pattern URL ricostruito

**Aggiornamento:** giornaliero, file rigenerati tra 22:30 e 23:05 UTC.

```
https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/{kind}/{YYYY}_{M}/{filename}
```

Dove:
- `{YYYY}` = anno della data dello snapshot (es. `2026`)
- `{M}` = mese senza zero leading (es. `5`, NON `05`)
- `{kind}` = una di: `offerte`, `parametri`, `offerteML`, `parametriML`
- `{filename}` segue lo schema sotto.

| filename | kind | tipo | esempio per oggi (2026-05-01) | size tipica | offerte |
|---|---|---|---|---|---|
| `PO_Offerte_E_PLACET_YYYYMMDD.csv` | offerte | PLACET elettrico | `2026_5/PO_Offerte_E_PLACET_20260501.csv` | ~340 KB | ~909 |
| `PO_Offerte_G_PLACET_YYYYMMDD.csv` | offerte | PLACET gas | `2026_5/PO_Offerte_G_PLACET_20260501.csv` | ~485 KB | ~1184 |
| `PO_Parametri_E_YYYYMMDD.csv` | parametri | parametri PLACET elettrico | `2026_5/PO_Parametri_E_20260501.csv` | ~10 KB | ~80 righe |
| `PO_Parametri_G_YYYYMMDD.csv` | parametri | parametri PLACET gas | `2026_5/PO_Parametri_G_20260501.csv` | ~6 KB | ~50 righe |
| `PO_Offerte_E_MLIBERO_YYYYMMDD.xml` | offerteML | Mercato Libero elettrico | `2026_5/PO_Offerte_E_MLIBERO_20260501.xml` | ~18 MB | ~migliaia |
| `PO_Offerte_G_MLIBERO_YYYYMMDD.xml` | offerteML | Mercato Libero gas | `2026_5/PO_Offerte_G_MLIBERO_20260501.xml` | ~11 MB | ~migliaia |
| `PO_Offerte_D_MLIBERO_YYYYMMDD.xml` | offerteML | Mercato Libero dual fuel | `2026_5/PO_Offerte_D_MLIBERO_20260501.xml` | ~116 KB | 33 |
| `PO_Parametri_Mercato_Libero_E_YYYYMMDD.csv` | parametriML | parametri ML elettrico | `2026_5/PO_Parametri_Mercato_Libero_E_20260501.csv` | ~10 KB | identico a parametri PLACET |
| `PO_Parametri_Mercato_Libero_G_YYYYMMDD.csv` | parametriML | parametri ML gas | `2026_5/PO_Parametri_Mercato_Libero_G_20260501.csv` | ~6 KB | identico a parametri PLACET |

In aggiunta, su path diverso, c'e un file mensile coi prezzi storici degli indici di
riferimento PUN/PSV — gia raccolti dagli spike GME PUN + PSV ma utile come riferimento
incrociato:

```
https://www.ilportaleofferte.it/portaleOfferte/resources/cms/documents/fe9833ce8870cb2e146cce5cafe3e7df.csv
```

**Attenzione**: l'URL del file prezzi-storici e un hash CMS, NON segue il pattern data.
Va fetchato dalla pagina open-data e aggiornato se cambia (caso reale: lo screenshot
attuale mostra "Ultimo aggiornamento: 15-04-2026" — quindi una volta al mese).

---

## Schema PLACET CSV (Offerte_E)

**Encoding:** UTF-8, separatore `,`, CRLF, NO virgolette, **nessuna virgola embedded**
(verificato: tutte le 910 righe hanno esattamente 26 campi). Si puo splittare con un
banale `line.split(",")`.

26 colonne:

```
denominazione, codice_fiscale, p_iva, url_sito_venditore, telefono,
nome_offerta, cod_offerta, url_offerta,
modalita_attivazione, modalita_pagamento,    # liste separate da `;`
data_inizio, data_fine,                       # gg/mm/yyyy
tipo_cliente,                                 # "domestico" | "non domestico" | "condominio"
tipo_offerta,                                 # "prezzo fisso" | "prezzo variabile"
p_fix_f,                                      # quota fissa €/anno (per prezzo fisso)
p_fix_v,                                      # quota fissa €/anno (per prezzo variabile)
p_vol_f1, p_vol_f2, p_vol_f3,                 # prezzo €/kWh per fascia oraria F1/F2/F3
p_vol_bf1, p_vol_bf23, p_vol_mono,            # variants for biorario / monorario
alpha,                                        # spread sull'indice (variabili) €/kWh
regione, provincia, comune                    # vuoti per offerte nazionali
```

Per Gas (PO_Offerte_G_PLACET) le colonne sono 21: stessa testata fino a `p_fix_v`, poi
`p_vol`, `alpha`, `regione`, `provincia`, `comune` — niente fasce orarie.

**Distribuzione PLACET E (snapshot 2026-05-01):**

- 462 domestico, 447 non domestico, 1 condominio
- 428 prezzo fisso, 481 prezzo variabile

Volume **piu che sufficiente** per calcolare mediane/quartili stabili giorno per giorno.

---

## Schema Mercato Libero XML

Namespace: `http://www.acquirenteunico.it/schemas/SII_AU/OffertaRetail/01`

Struttura (root): `<ListaOfferteMercatoLibero>` -> N x `<offerta>` con sottoblocchi
`IdentificativiOfferta`, `DettaglioOfferta`, `RiferimentiPrezzoEnergia`, `ValiditaOfferta`,
`CaratteristicheOfferta`, `OffertaDual`, `MetodoPagamento` (multipli),
`ComponentiRegolate`, `TipoPrezzo`, `Dispacciamento`, `ComponenteImpresa` (multipli con
`IntervalloPrezzi` x fasce), `CondizioniContrattuali`.

Codici principali (spec ARERA SII_AU):
- `TIPO_MERCATO`: `01`=elettrico, `02`=gas, `03`=dual
- `TIPO_CLIENTE`: `01`=domestico, `02`=non domestico
- `TIPO_OFFERTA`: `01`=prezzo fisso, `02`=prezzo variabile, `03`=offerta dispatching
- `IDX_PREZZO_ENERGIA`: indice per le variabili (`12` = PUN nel campione visto)

Il prezzo "energia" non e un singolo campo: e un insieme di `<ComponenteImpresa>` con
fasce. Il parser ML va costruito incrementalmente in Fase 1 — per il **MVP Energy Index
e raccomandato partire dal solo PLACET**, che da gia 4 metriche pulite e copre il regime
"comparabile" definito dal regolatore (offerte standardizzate).

`fast-xml-parser` (gia installato per gli spike GME) e ottimo per parsare questi file
(streaming non strettamente necessario a 18 MB).

---

## Aspetti legali e di policy

Pagina `it/informazioni-legali.page`:

> "Fatta eccezione per le sezioni della specifica "Open data", il cui uso e libero, il
> contenuto del presente sito e di proprieta di Acquirente Unico ed e tutelato dalle
> leggi internazionali sul diritto d'autore."

Pagina `it/open-data.page`:

> "Tutte le informazioni e i dati esposti nel presente portale, concernenti le offerte,
> sono in modalita 'aperta'."

> "Ai fini di adempiere all'obbligo di pubblicita, trasparenza e diffusione delle
> informazioni per le pubbliche amministrazioni e le societa partecipate, sancito dalla
> Legge n. 190/2012 e dal successivo D.lgs. n. 33/2013... tutte le informazioni e i dati
> esposti nel presente portale, concernenti le offerte, sono in modalita 'aperta'."

**Conclusione**: i file sotto `/resources/opendata/...` e quelli linkati esplicitamente
dalla open-data.page sono per legge in regime "open" (non e una CC-BY formalmente
dichiarata, ma il regime di trasparenza ex L. 190/2012 e D.Lgs. 33/2013 li rende
liberamente riutilizzabili anche per uso commerciale, inclusi servizi derivati come
Energy Index). Non rilevato un robots.txt ostile (non bloccante per noi: i file sono
in resources/static, non in pagine search).

**Best practice da rispettare**:
- User-Agent identificativo (gia adottato).
- Frequenza di download contenuta — settimanale ampiamente sufficiente per
  l'aggregazione richiesta.
- Citazione della fonte ("Fonte: Portale Offerte — Acquirente Unico S.p.A. — ARERA")
  nella UI di Energy Index quando vengono mostrati gli aggregati derivati.

---

## Plan per Fase 1

1. **MVP — solo PLACET CSV.** 4 download al giorno, parsing banale split-by-comma,
   produce subito 4 aggregati Energy Index (Fisse Luce, Variabili Luce, Fisse Gas,
   Variabili Gas) con n campione 400-600 ciascuno. Niente nuove dipendenze npm.
2. **Estensione — Mercato Libero XML.** Aggiunge il volume completo (~migliaia di
   offerte). Parsing con `fast-xml-parser` (gia in dependencies). Schema piu ricco
   richiede mappature TIPO_OFFERTA/TIPO_MERCATO + estrazione del prezzo energia da
   `<ComponenteImpresa>` per fasce — lavoro non banale ma fattibile.
3. **Riferimento incrociato — prezzi-storici.csv.** Mensile, fornisce PUN/PSV ufficiali
   pubblicati dal Portale stesso: utile come fall-back rispetto a GME (gia spikato) e
   per verifica di consistenza degli spread `alpha`.
4. **Sched.** Cron settimanale. Rate limit 1 req/3s tra i file. Idempotente per data:
   se il file 2026-05-01 e gia stato scaricato e il SHA256 e identico, no-op.

Nessun fall-back a Caso B/C necessario: il bulk pubblico c'e ed e di prima qualita.

---

## File prodotti dallo spike

- `spikes/arera-offers.ts` — downloader funzionante (PLACET) + parser puro testabile.
- `spikes/samples/fixtures/arera-offers-placet-fixture.csv` — 6 righe anonimizzate (3 elettrico fisso, 3 elettrico variabile) prese dal feed reale.
- `spikes/samples/fixtures/arera-offers-mlibero-fixture.xml` — 2 offerte ML anonimizzate (1 fissa, 1 variabile) per verifica forma XML futura.
- `spikes/samples/fixtures/arera-offers-fixture-NOTES.md` — documentazione fixture e anonymization policy.
- `tests/parsers/arera-offers.test.ts` — test sul parser PLACET.
- `spikes/reports/arera-<timestamp>.md` — report di esecuzione (scritto dallo script).
