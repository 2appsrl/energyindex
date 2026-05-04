# Energy Index — Spike Report Fase 0 (FINAL)

**Status**: FINAL — tutte e 4 le fonti verificate (PUN, PSV, ENTSO-E, ARERA). Pendono solo code review, merge a `main` + tag, e approvazione utente per partire con la Fase 1.
**Data inizio Fase 0**: 2026-05-01
**Data ultimo aggiornamento**: 2026-05-04
**Branch**: `feature/fase-0-spike`

> Questo è un documento di decisione che chiude la Fase 0 (verifica fonti dati) e abilita la Fase 1 (MVP). La versione PRELIMINARY (2026-05-01) è stata aggiornata in place al ricevimento del token ENTSO-E e dopo la verifica della clausola di licenza GME — vedi sezione 10 per il diff con la versione preliminare.

---

## 1. Sommario decisionale

| Fonte | Status spike | Decisione | Plan A (production) | Plan B (fallback) |
|---|---|---|---|---|
| GME PUN | ✅ verified | GO | **DNN scraping** (sito pubblico `mercatoelettrico.org`, helper `spikes/lib/gme-dnn.ts` validato in Fase 0) | API ufficiale `api.mercatoelettrico.org` **solo se ottenuta licenza commerciale separata da GME** (la licenza standard "uso informativo privato" non è compatibile con la pubblicazione su sito gratuito) |
| GME PSV | ✅ verified | GO | **DNN scraping** (stesso sito pubblico, stesso helper condiviso) | API ufficiale `api.mercatoelettrico.org` **solo con licenza commerciale GME** (idem PUN) |
| ENTSO-E | ✅ verified | GO | Restful API ufficiale `https://web-api.tp.entsoe.eu/api` con `securityToken` (UUID rilasciato dietro registrazione gratuita) — testato su DE_LU/FR/IT_NORTH | Niente fallback necessario; in caso di token revocato / rate-limit prolungato, `assets.unit` con prezzi paesi EU passa in stato "stale" senza fonti alternative omogenee |
| ARERA Offerte | ✅ verified | GO | Bulk CSV PLACET pubblico (regime open data ex L. 190/2012 + D.Lgs. 33/2013) | XML Mercato Libero come estensione v2 |

**Verdetto complessivo (FINAL)**: 4/4 fonti verificate e accessibili. Il rischio "principale del progetto" (ARERA) è risolto in positivo: bulk pubblico esiste, è di prima qualità, niente scraping HTML fragile. ENTSO-E è verified GO: token funzionante, parser stabile su 3/3 zone testate (DE_LU/FR/IT_NORTH), resolution PT15M (96 punti/giorno). **Cambio strategico vs preliminare per GME**: la licenza standard dell'API ufficiale è "uso informativo privato" — incompatibile col caso d'uso Energy Index (sito informativo pubblico gratuito con monetizzazione indiretta via energiapro.biz). Plan A è quindi il canale DNN (scraping del sito pubblico) e l'API ufficiale resta una possibilità solo previa licenza commerciale separata da negoziare con GME. La pubblicazione "Fonte: GME" sul sito Energy Index andrebbe comunque confermata via mail/PEC a GME prima del launch pubblico — non bloccante per dev/staging interno.

---

## 2. Esecuzione vs piano

Cosa è cambiato rispetto al piano `docs/plans/2026-05-01-fase-0-spike-fonti-dati.md`:

- **Tutte le URL GME del piano sono 404**. Il sito `mercatoelettrico.org` è stato rifatto su DotNetNuke + un modulo Angular client. Le URL `DatiSintesi.aspx`, `EsitiXML.aspx` non esistono più. URL reali identificate negli spike (vedi sez. 3.1, 3.2).
- **Formato dati GME atteso XML, in realtà JSON**. La Web API DNN restituisce array JSON puri (`{df, h, p, qh}` per il PUN, struttura più ricca per il gas). `fast-xml-parser` non è stato necessario per questi spike — `JSON.parse` è sufficiente.
- **Esiste un canale API ufficiale GME nuovo**: `api.mercatoelettrico.org`, attivo dal 15 ottobre 2025 (manuale tecnico https://www.mercatoelettrico.org/Portals/0/Documents/en-US/20251015Manuale_tecnico_API_En.pdf). Richiede registrazione + credenziali, dati storici solo dal 2025-10-01. **Strada raccomandata per produzione**, con il canale DNN come fallback / dev sandbox.
- **GME ha un quirk backend**: l'endpoint PUN ignora il parametro `Zona` quando `Tipologia=PUN`. Workaround: `Tipologia=PUN` (solo per nazionale) + `Tipologia=PrezziZonali` (per le 6 zone fisiche). Documentato in `spikes/gme-pun.ts`.
- **Anche le URL ARERA del piano sono fantasma**: `static/contenuti/datiOfferte.html` e `it/ricerca-offerte.page` ritornano 404 / redirect a notfound. URL reale: `it/open-data.page` con pattern deterministico `/portaleOfferte/resources/opendata/csv/{kind}/{YYYY}_{M}/PO_*_{YYYYMMDD}.{csv|xml}`. Nessuno scraping HTML necessario.
- **Decisione architetturale: bootstrap DNN session fattorizzato** — gli spike PUN e PSV condividono `spikes/lib/gme-dnn.ts` (cookie ASP.NET + RequestVerificationToken + TabId/ModuleId estratti dalla pagina contenitore). Pattern riusabile in Fase 1 per gli ETL, qualora si scelga il fallback DNN al posto dell'API ufficiale.
- **PUN ridefinito dal 1° gennaio 2025**: non è più la media aritmetica zonale ma il "PUN Index GME" (media ponderata sui volumi). L'API lo espone con `Zona=PUN`. Da menzionare nelle pagine `/indice/pun` per accuratezza.
- **Fixture committate, raw ignorato**: tutti i sample raw scaricati sono in `spikes/samples/raw/` (gitignored). Solo le fixture anonimizzate vivono nel repo (`spikes/samples/fixtures/`).

---

## 3. Dettaglio fonti

### 3.1 GME PUN — ✅ verified

- **URL/canale verificato**:
  - Pagina contenitore: `https://www.mercatoelettrico.org/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN`
  - Endpoint dati: `https://www.mercatoelettrico.org/DesktopModules/GmeEsitiPrezziME/API/item/GetMEPrezzi?DataInizio=YYYYMMDD&DataFine=YYYYMMDD&Granularita=h&Mercato=MGP&Zona=<PUN|NORD|CNOR|CSUD|SUD|SICI|SARD>&Tipologia=<PUN|PrezziZonali>`
- **Formato**: JSON, array di righe `{df: 20260501, h: 1..24, p: 142.30, qh: 4}` (df=data flusso, h=ora, p=prezzo €/MWh, qh=indice quarto d'ora).
- **Frequenza pubblicazione**: ~12:30 ora italiana, dati per il giorno successivo (asta MGP).
- **Authentication**: nessuna utente. Servono cookie ASP.NET + `RequestVerificationToken` + headers DNN (`TabId`, `ModuleId`) scrapati una tantum dalla pagina contenitore. Helper `spikes/lib/gme-dnn.ts`.
- **Sample size**: 24 ore × (1 PUN nazionale + 6 zone) = **168 punti per giorno**. Verificato sullo spike: 7/7 chiamate HTTP 200, 24 righe ciascuna.
- **Range valori osservati** (sessione 2026-05-01): 0.00–149.35 €/MWh, mediana 122.03 €/MWh. Festa del lavoro, zone perfettamente convergenti — fixture committata invece su 2026-04-30 (giorno feriale, divergenza Nord vs Sud reale).
- **Robustezza prevista**: alta. Endpoint stabile, schema rigorosamente tipato con `zod`, parser puro testabile.
- **API ufficiale alternativa (con caveat di licenza)**: `https://api.mercatoelettrico.org/`, attiva dal 15/10/2025. Manuale: https://www.mercatoelettrico.org/Portals/0/Documents/en-US/20251015Manuale_tecnico_API_En.pdf. La pagina di registrazione (`https://api.mercatoelettrico.org/users/RegistrationForm/RegistrationRequest`, verificata 2026-05-04) è teoricamente aperta a *"singolo Utente sia esso una persona fisica, persona giuridica o altro ente"* a titolo gratuito, MA la licenza concessa è esplicitamente **"uso informativo privato"**. Tale clausola non copre la ripubblicazione dei dati su un sito informativo pubblico commerciale come Energy Index (anche se gratuito per l'utente finale, è veicolo SEO/brand verso energiapro.biz). **Conclusione**: l'API ufficiale è praticabile come Plan A solo previa **licenza commerciale separata da negoziare con GME** (mail/PEC a GME). Senza licenza commerciale, Plan A resta il canale DNN. Verifica formale con GME consigliata anche per il canale DNN (Condizioni d'uso del sito), non bloccante per dev/staging interno ma sì per launch pubblico.
- **Fixture**: `spikes/samples/fixtures/gme-pun-fixture.json` — sessione 2026-04-30 con divergenza zonale visibile (NORD/CNOR ~107.79 €/MWh vs CSUD/SUD/SICI/SARD ~101.81 €/MWh). 168 righe totali.
- **Test**: 4 test in `tests/parsers/gme-pun.test.ts`, tutti pass:
  1. parsa 24 valori PUN orari da sample reale
  2. parsa 6 serie zonali (NORD, CNOR, CSUD, SUD, SICI, SARD)
  3. ritorna ore ordinate 1..24 in ogni serie
  4. preserva la divergenza zonale reale del fixture
- **Quirk noto**: il parametro `Zona` viene **ignorato dal backend** quando `Tipologia=PUN` — restituisce sempre il PUN nazionale a prescindere. Workaround in `spikes/gme-pun.ts`: usare `Tipologia=PUN` solo per la zona "PUN" (nazionale), `Tipologia=PrezziZonali` per le 6 zone fisiche.
- **Caveat**:
  - Granularità disponibili: `qh` (15min), `hh` (30min), `h` (orario), `d`, `m`, `y`. Per Energy Index uso `h`.
  - Il modulo Angular client mostra un disclaimer cookie `GmePolicy`. Il backend NON lo richiede — testato omettendo il cookie e ricevendo HTTP 200. Resta una constraint legale (T&C sito) ma non tecnica.
  - DST: schema PUN ammette `h: 25` (ora 25, DST autunno) ma non `h: 23` (DST primavera). Da verificare in Fase 1 con fixture DST primavera 2026-03-29.

### 3.2 GME PSV — ✅ verified

- **URL/canale verificato**:
  - Pagina contenitore: `https://www.mercatoelettrico.org/it-it/Home/Esiti/Gas/MGP/Esiti`
  - Endpoint dati: `https://www.mercatoelettrico.org/DesktopModules/GmeEsitiMGAS/API/item/GetGasEsitiMGAS?DataSessione=YYYYMMDD&Mercato=MGP`
- **Formato**: JSON, array di righe per la sessione di trading. Ogni riga = un prodotto (`MGP-YYYY-MM-DD` consegna giornaliera, `WD-YYYY-WW` within-day, `WE-YYYY-WW` weekend). Campi rilevanti: `prezzoRiferimento`, `prezzoControllo`, `firstPrice/lastPrice/prezzoMinimo/prezzoMassimo`, `volumiMW/volumiMWh`, `posizioniAperte`. Tutti i campi prezzo sono `nullable`.
- **Frequenza pubblicazione**: fine giornata, 1 valore canonico per data di consegna (convenzione: `prezzoRiferimento` del prodotto `MGP-(T+1)` per la sessione di trading T = "PSV day-ahead"). Mercato gas opera 7/7 — niente buchi su weekend/festivi.
- **Authentication**: identica al PUN — bootstrap DNN tramite `spikes/lib/gme-dnn.ts`. Nessun account utente.
- **Sample size**: 1 valore per giorno. Spike ha scaricato 7 sessioni consecutive (2026-04-25 → 2026-05-01) e ricostruito 6 punti consegna (2026-04-26 → 2026-05-01).
- **Range valori osservati** (settimana 2026-04-26 → 2026-05-01): 44.6816–46.3727 €/MWh, mediana 45.6803 €/MWh. In linea con TTF + spread Italia.
- **Robustezza prevista**: alta. Endpoint single-day richiede fan-out (1 call per sessione) ma è prevedibile e idempotente. Parser tollera sessioni vuote (`rows=0` osservato il 2026-05-01 al momento del fetch — Festa del lavoro, prezzo per consegna 2026-05-02 non ancora pubblicato).
- **API ufficiale alternativa (con caveat di licenza — idem PUN)**: stesso canale `api.mercatoelettrico.org` del PUN (manuale 2025-10-15). Supporta `MGP-GAS / PBZ-PSV`. Vale la stessa restrizione di licenza descritta per il PUN: la registrazione standard rilascia una licenza "uso informativo privato" non compatibile con la ripubblicazione su sito Energy Index. L'utilizzo dell'API ufficiale richiede **licenza commerciale separata GME**, da richiedere via mail/PEC. Verifica formale con GME consigliata anche per il canale DNN (Condizioni d'uso del sito), non bloccante per dev/staging interno ma sì per launch pubblico.
- **Fixture**: `spikes/samples/fixtures/gme-psv-fixture.json` — 7 sessioni (2026-04-25 → 2026-05-01) con dedup by-data-consegna, 6 punti estratti.
- **Test**: 3 test in `tests/parsers/gme-psv.test.ts`, tutti pass:
  1. parsa valori PSV daily da sample reale
  2. ritorna date di consegna in ordine ascendente, niente duplicati
  3. tollera sessioni di trading vuote senza crashare
- **Quirk noto**: l'API è **single-day** — non accetta range. `DataSessione=0` ritorna l'ultima sessione disponibile (utile per "fetch latest"). Niente parametro `Zona` (PSV è l'unico hub italiano, implicito).
- **Caveat**:
  - Le righe del payload sono *prodotti*, non giorni. Una sessione T tipicamente espone `MGP-(T+1)` valorizzato + `MGP-(T+2)`, `MGP-(T+3)` con `prezzoRiferimento=null` + `WD-YYYY-WW` (intraday) + nei venerdì `WE-YYYY-WW` (weekend).
  - **Re-published prices**: il parser oggi gestisce solo `MGP-(T+1)` puro. Eventuali rettifiche post-asta in sessioni successive richiederanno logica più ampia in Fase 1.

### 3.3 ENTSO-E day-ahead — ✅ verified

- **URL/canale verificato**:
  - Endpoint: `https://web-api.tp.entsoe.eu/api`
  - Pattern: `?documentType=A44&in_Domain={EIC}&out_Domain={EIC}&periodStart=YYYYMMDDHHmm&periodEnd=YYYYMMDDHHmm&securityToken={UUID}`
  - Documentazione ufficiale: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html
  - Lista EIC bidding zones: `spikes/lib/entsoe-domains.ts`. Verificate 3/3 nello spike: `DE_LU=10Y1001A1001A82H`, `FR=10YFR-RTE------C`, `IT_NORTH=10Y1001A1001A73I`. Restanti zone documentate (IT_CNORTH/CSOUTH/SOUTH/SICILY/SARDINIA + ES/AT/NL/BE/CH) attese funzionanti col medesimo schema.
- **Formato**: XML — `Publication_MarketDocument` → 1..N `TimeSeries` (auction primaria + eventuali secondarie con `classificationSequence` differente) → `Period` (con `start/end` in UTC e `resolution` ISO 8601) → `Point[]` (`position` 1-based + `price.amount`). `currency=EUR`, `unit=MWH`. Parser puro testabile in `spikes/entsoe-dayahead.ts` (`parseEntsoeDayAhead`).
- **Frequenza pubblicazione**: ~12:00 CET (chiusura asta day-ahead europea); prezzi del giorno seguente disponibili subito dopo. Cron Energy Index previsto 14:00 Europe/Rome.
- **Authentication**: `securityToken` UUID (non JWT) come **query param**, NON header. Rilasciato via email entro 1-3 giorni lavorativi dietro registrazione gratuita su https://transparency.entsoe.eu/. Memorizzato in `.env` come `ENTSOE_API_TOKEN` (NON committato; `.env.example` espone solo lo slot).
- **Sample size** (sessione 2026-05-04 UTC, day-ahead per il 2026-05-04):
  - DE_LU: 95 Point (29 KB XML, parser OK)
  - FR: 96 Point (15 KB XML, parser OK)
  - IT_NORTH: 88 Point (14 KB XML, parser OK)
  - **Resolution PT15M** ovunque (giornata standard = 96 quarter-hour intervals; le zone con count <96 hanno applicato compressione `curveType=A03` con sparse points e propagazione implicita).
- **Range valori osservati** (sessione 2026-05-04 UTC):
  - DE_LU: −124.62 / mediana 107.57 / 250.07 €/MWh (range espressivo, include picchi negativi da eccesso rinnovabili e picchi alti pomeridiani)
  - FR: 60.95 / 110.94 / 163.83 €/MWh
  - IT_NORTH: 89.00 / 136.03 / 199.51 €/MWh (delta IT-DE coerente con la storia: Italia tipicamente più cara, niente prezzi negativi).
- **Robustezza prevista**: alta. Endpoint ENTSO-E è stato pubblicato sotto regolamento (UE) 543/2013 (Transparency Regulation), l'infrastruttura è gestita da ENTSO-E come servizio pubblico → schema stabile, breaking change rari (la migrazione PT60M → PT15M 2025-2026 è l'unica osservata).
- **Fixture**: `spikes/samples/fixtures/entsoe-de-fixture.xml` — 29 KB, snapshot reale DE_LU del 2026-05-04 UTC, senza token né altri elementi sensibili (solo prezzi pubblici di mercato). Provenance dettagliata in `spikes/samples/fixtures/entsoe-fixture-NOTES.md`.
- **Test**: 3 test in `tests/parsers/entsoe.test.ts`, tutti pass:
  1. parsa il day-ahead da sample DE_LU reale (count compreso fra 23 e 100 per coprire PT60M/PT15M/DST/curveType A03; range prezzi −200..2000 €/MWh)
  2. preserva l'ordinamento per `position` ascendente (richiesto dai consumatori downstream)
  3. espone `currency=EUR`, `unit~/MWH/i`, `domain=10Y1001A1001A82H` per DE_LU, e `resolution` ISO 8601 valida (`PT15M`/`PT30M`/`PT60M`)
- **Quirk noti**:
  - **Multi-TimeSeries**: una risposta può contenere asta primaria + secondaria (DE_LU 2026-05-04 ne ha 2). Selezione canonica via `auction.type=A01` o `classificationSequence` minore — da gestire in Fase 1 ETL.
  - **curveType A03 (sparse points con propagazione)**: l'API può restituire meno di 96 point se i prezzi consecutivi sono uguali (compressione XML); l'ETL Fase 1 deve **espandere la serie sparsa in 96 quarter-hour intervals densi** prima di scrivere su `price_observations`. Lo spike osserva 95 e 88 punti per DE_LU/IT_NORTH.
  - **Tomorrow non sempre disponibile**: se interroghiamo "oggi UTC → domani UTC" prima delle ~12:00 CET riceviamo 200 con `Acknowledgement_MarketDocument` (no data) o TimeSeries vuoto. Lo spike fa fallback automatico a "ieri UTC → oggi UTC".
  - **Format temporale obbligatoriamente UTC**: `periodStart/periodEnd` in `YYYYMMDDHHmm` UTC, NON ora locale italiana / CET — usare CET porta a 200 con TimeSeries vuoto o dati shiftati.
- **Caveat**:
  - **Rate limit**: limiti per-secondo non documentati con precisione + **cap mensile per token** (esiste, soglia esatta non pubblicata). Spike adotta 1 s di pausa fra zone e retry singolo su 429. In Fase 1 batch gigante (15-20 zone × backfill mesi) richiede politeness conservativa.
  - **DST**: la risposta può contenere meno o più punti a fine marzo / fine ottobre (Europe/Rome). Il parser preserva `position` così come fornita dall'API; la conversione `position → timestamp UTC` va fatta a valle usando `Period.start` + `resolution`.
  - **Attribuzione obbligatoria**: i Terms of Use ENTSO-E richiedono di citare *"Source: ENTSO-E Transparency Platform"* e di linkare https://transparency.entsoe.eu/. Da inserire nel footer e in eventuali export — open under EU Regulation 543/2013, riutilizzo libero anche commerciale a condizione dell'attribuzione.

### 3.4 ARERA Portale Offerte — ✅ verified

- **URL/canale verificato**:
  - Pagina indice: `https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page`
  - Pattern URL bulk: `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/{kind}/{YYYY}_{M}/PO_{file}_{YYYYMMDD}.{csv|xml}` (con `M` mese **senza zero leading**, es. `5` non `05`).
  - 4 file PLACET del giorno (E offerte / G offerte / E parametri / G parametri) tutti HTTP 200, content-type `text/csv`.
  - 3 file Mercato Libero (E/G/D) verificati via HEAD, tutti HTTP 200, content-type `application/xml`.
- **Formato**: CSV UTF-8 separator `,`, CRLF, **nessuna virgola embedded** (verificato su 909 righe). PLACET E = 26 colonne, PLACET G = 21 colonne. Mercato Libero XML schema namespace `http://www.acquirenteunico.it/schemas/SII_AU/OffertaRetail/01`.
- **Frequenza pubblicazione**: **giornaliera**, file rigenerati ogni notte. `Last-Modified` osservato tra 22:30 e 23:05 UTC (presumibilmente fascia notturna ARERA).
- **Authentication**: **nessuna**. Niente token, niente cookie speciali. Solo User-Agent identificativo per cortesia.
- **Sample size** (snapshot 2026-05-01):
  - PLACET Elettrico: 909 offerte (462 domestico + 447 non domestico + 1 condominio; 428 fissi + 481 variabili).
  - PLACET Gas: 1184 offerte (547 fissi + 637 variabili).
  - Mercato Libero E: 18.2 MB (~migliaia di offerte). ML G: 10.5 MB. ML D (dual): 116 KB / 33 offerte.
- **Range valori osservati**: vedi sezione 4 (preview Energy Index aggregati).
- **Robustezza prevista**: alta. URL stabile, schema CSV rigido, regime legale "open" formalmente dichiarato.
- **Regime legale (open data)**: dichiarato esplicitamente nella pagina open-data: *"Tutte le informazioni e i dati esposti nel presente portale, concernenti le offerte, sono in modalità 'aperta'. Ai fini di adempiere all'obbligo di pubblicità, trasparenza e diffusione delle informazioni... sancito dalla Legge n. 190/2012 e dal successivo D.Lgs. n. 33/2013."* Riutilizzo libero anche per servizi commerciali derivati (cita `spikes/notes/arera-investigation.md` per riferimento testuale completo).
- **Fixture**: `spikes/samples/fixtures/arera-offers-placet-e-fixture.csv` (6 righe + header), `arera-offers-placet-g-fixture.csv` (4 righe + header), `arera-offers-mlibero-fixture.xml` (2 offerte). Anonimizzazione: campi vendor/CF/PIVA/URL sostituiti con placeholder; valori economici reali presi dal feed 2026-05-01.
- **Test**: 13 test in `tests/parsers/arera-offers.test.ts`, tutti pass. Coprono: URL builder con month-no-zero, parser PLACET E (26 col), parser PLACET G (21 col), bucket fisso vs variabile, scelta del campo prezzo (mono / fasce / alpha), aggregati con quartili interpolati.
- **Caveat**:
  - **Pattern URL gotcha**: il `{M}` nel path dev'essere il mese **della data del filename**, non il mese corrente. Es. `2026_4/PO_Offerte_E_PLACET_20260430.csv` = OK; `2026_5/PO_Offerte_E_PLACET_20260430.csv` = 404.
  - **Prezzi storici PUN/PSV** ARERA esposti su path diverso (`/resources/cms/documents/{hash}.csv`), URL = hash CMS non deterministico, va ottenuto dalla pagina open-data e aggiornato se cambia (mensile, "Ultimo aggiornamento" osservato 2026-04-15). Utile come riferimento incrociato vs GME.
  - Mercato Libero XML è ricco (`<ComponenteImpresa>` con fasce orarie) ma **non necessario** per l'MVP — il PLACET copre già il regime "comparabile" definito dal regolatore.

---

## 4. Energy Index aggregati — preview con dati reali

Calcolati dal feed PLACET ARERA del 2026-05-01 (snapshot reale, parser pulito):

| Indice | Min | p25 | Mediana | p75 | Max | Sample size | Unità |
|---|---|---|---|---|---|---|---|
| Energy Index · Fisse Luce | 0.000 | 0.260 | **0.350** | 0.550 | 2.000 | 428 | €/kWh |
| Energy Index · Variabili Luce (alpha) | 0.008 | 0.040 | **0.060** | 0.100 | 1.000 | 481 | €/kWh (spread su PUN) |
| Energy Index · Fisse Gas | 0.530 | 1.000 | **1.500** | 2.000 | 5.000 | 547 | €/Smc |
| Energy Index · Variabili Gas (alpha) | 0.035 | 0.200 | **0.300** | 0.550 | 3.500 | 637 | €/Smc (spread su PSV) |

Fonte: `spikes/reports/arera-2026-05-01T21-12-30-060Z.md`, sezione 3.

**Nota fondamentale per UI**: i valori "variabili" sono **spread (alpha)** sul prezzo di riferimento, NON prezzi assoluti. La UI deve combinare `alpha + PUN/PSV corrente` per mostrare un €/kWh confrontabile con i fissi. Il modello dati prevede già che `assets.unit` distingua €/kWh vs €/Smc, e per le variabili la commodity-card deve esplicitare "spread" (vedi sezione 5 — aggiornamenti design).

Il sample size per ciascuno dei 4 aggregati è abbondante (428–637 offerte) per produrre mediane/quartili stabili giorno per giorno.

---

## 5. Aggiornamenti necessari al design doc

Lista esplicita di cose da modificare in `docs/plans/2026-05-01-energy-index-design.md` alla luce di quanto trovato:

1. **Sezione 7 (Pipeline dati)** — aggiungere riferimento all'**API ufficiale GME** `api.mercatoelettrico.org` come Plan A per `etl-gme-pun` ed `etl-gme-psv`, con il canale **DNN scraping** come fallback documentato (e unica opzione per backfill pre-2025-10-01).

2. **Sezione 7 (Pipeline dati)** — aggiornare la riga ARERA: l'attuale design implicitamente assume scraping (cita "Portale Offerte" senza specificare). In realtà **bulk CSV pubblico daily-refresh** disponibile, niente scraping. Cron settimanale lunedì 06:00 UTC è sufficiente (file freschi dalla notte precedente).

3. **Sezione 7 — Spike obbligatori (lista finale)** — annotare l'esito di ciascuno e rimuovere "ARERA: scraping HTML legale ma fragile" come Plan B (non più necessario).

4. **Sezione 11 (Open items / footer)** — aggiungere/rifinire le **attribuzioni richieste**:
   - **GME**: verificare T&C uso commerciale prezzi MGP (canale ufficiale e DNN) prima di lanciare in produzione. Disclaimer "Fonte: GME — Gestore dei Mercati Energetici".
   - **ARERA**: testo standard *"Fonte: Portale Offerte — Acquirente Unico S.p.A. — ARERA"* sulla card Energy Index e nel footer.
   - **ENTSO-E**: clausola di attribuzione standard (TBD a verifica del token e relativi ToS).

5. **Sezione 6 (Modello dati)** — assicurarsi che `assets.unit` distingua €/kWh, €/Smc, €/MWh; e che per le offerte variabili sia ESPLICITO che il valore memorizzato è uno **spread vs reference** (e non un prezzo assoluto). Il modello dati attuale lo prevede già concettualmente — serve enfasi nei test e nella UI.

6. **Sezione 4 / 6** — annotare che il "PUN" dal 1° gennaio 2025 è il **PUN Index GME** (media ponderata sui volumi), non più la media aritmetica zonale. Da menzionare nelle pagine `/it/indice/pun` e `/it/metodologia` per accuratezza.

7. **Sezione 3 (Modello aggiornamento)** — la PSV è 7/7 (mercato gas opera anche su weekend/festivi); il PUN no (asta MGP non gira sui festivi → niente prezzo per consegna del giorno dopo). Da riflettere nella UI staleness/skeleton states.

---

## 6. Costi nascosti emersi

- **GME T&C uso commerciale**: da verificare con avvocato prima di lanciare in produzione (non bloccante per dev/staging interno, ma sì per launch pubblico). Vale per entrambi i canali (ufficiale e DNN).
- **DST handling**: schema PUN ammette `h: 25` (DST autunno) ma non `h: 23` (DST primavera). Da gestire in Fase 1 con fixture DST primavera 2026-03-29.
- **API ufficiale GME limitata a dati >= 2025-10-01**: per backfill pre-2025-10 serve comunque DNN scraping (o accettare assenza di storico).
- **Rate limiting**: nessuno spike ha osservato 429, ma per backfill ENTSO-E e GME serve politeness delay (250ms+ tra chiamate, retry/backoff esponenziale come da design sezione 7).
- **ARERA fixture CRLF/LF**: parser tollera entrambi (normalizza in `\n`) ma file production sono CRLF — da verificare in test integrazione Fase 1.
- **Re-published prices (gas)**: il parser PSV oggi gestisce solo `MGP-(T+1)` "fresh"; prezzi rettificati in sessioni successive (fix-up post-asta) richiedono logica più ampia in Fase 1.
- **GME quirk PUN/Zona**: documentato. Da non dimenticare in eventuali refactor (i test lo coprono indirettamente).
- **ARERA URL gotcha mese-senza-zero**: il path `2026_5/` (M senza zero) vs il filename `20260501` (zero presente) — già coperto da test su mesi a 1 cifra e a 2 cifre.
- **Mercato Libero XML peso**: ~28 MB combinato (E+G+D). Gestibile, ma non da lanciare ad ogni cron — schedulazione settimanale è ok.

---

## 7. Decisioni concrete per Fase 1

Sulla base degli spike, in Fase 1 (MVP Italia):

1. **etl-gme-pun**: **DNN scraping** del sito pubblico (helper `spikes/lib/gme-dnn.ts` già validato in Fase 0) come Plan A. Endpoint dati `https://www.mercatoelettrico.org/DesktopModules/GmeEsitiPrezziME/API/item/GetMEPrezzi` con bootstrap cookie ASP.NET + RequestVerificationToken + TabId/ModuleId. Tipologia=PUN per nazionale + Tipologia=PrezziZonali per le 6 zone. **Plan B**: API ufficiale `api.mercatoelettrico.org` solo previa licenza commerciale separata da GME (la licenza standard è "uso informativo privato", non utilizzabile per Energy Index). In ogni caso, verifica formale con GME via mail/PEC prima del launch pubblico anche per il canale DNN.
2. **etl-gme-psv**: stesso pattern del PUN, helper DNN condiviso. Endpoint single-day `https://www.mercatoelettrico.org/DesktopModules/GmeEsitiMGAS/API/item/GetGasEsitiMGAS?DataSessione={YYYYMMDD}&Mercato=MGP` con loop sulle date. Plan B: idem PUN (API ufficiale solo con licenza commerciale).
3. **etl-entsoe-dayahead**: Restful API `https://web-api.tp.entsoe.eu/api` con `securityToken` (rilasciato 2026-05-04). Path validato in Fase 0 su DE_LU/FR/IT_NORTH. ETL deve gestire: PT15M (96 punti/giorno per zona), curveType A03 con espansione sparse → dense, multi-TimeSeries (selezione asta primaria), fallback "ieri" se "domani" non ancora pubblicato. Rate limit prudenziale 1 s/zona. Attribuzione "Source: ENTSO-E Transparency Platform" obbligatoria nel footer.
4. **etl-arera-offers**: bulk CSV PLACET (E + G) come Plan A. ML XML come Plan B/v2 (da affrontare in Fase 2 se serve copertura completa mercato libero).
5. **compute-energy-index**: 4 aggregati come da preview sezione 4, fonte = bulk PLACET. Aggiungere computazione p25/p75 e spread vs reference. Gestire la card "Variabili" con etichetta esplicita "spread su PUN/PSV".
6. **Cron** (Europe/Rome):
   - PUN daily 13:00 (post asta MGP)
   - PSV daily 17:00 (fine giornata gas)
   - ENTSO-E daily 14:00 (post pubblicazione day-ahead europei)
   - ARERA settimanale lunedì 06:00 UTC (file freschi dalla notte precedente)
   - compute-energy-index daily 04:00
   - refresh-views post ogni ETL

---

## 8. Open items che restano

- **T&C/licenza GME** — verifica via mail/PEC a GME se la pubblicazione su sito informativo gratuito (con attribuzione "Fonte: GME — Gestore dei Mercati Energetici") è consentita anche col canale DNN. La licenza standard "uso informativo privato" dell'API ufficiale **NON copre** il caso d'uso Energy Index (sito pubblico veicolo SEO/brand verso energiapro.biz). Bloccante per launch pubblico, non per dev/staging interno.
- **Decisione finale dominio** (utente). `energyindex.it / .eu / .com` da verificare disponibilità.
- **API key Resend o equivalente per email alert** (utente, gratuita). Per gli alert di ETL fallito 2 giorni di fila.
- **Verifica robots.txt / rate limit policy** sui canali GME (DNN) e su ARERA al primo scale-up — non bloccante in spike (volumi minimi), va monitorato in produzione.
- **ENTSO-E rate limit/cap mensile** — soglia esatta non pubblicata; va monitorata in Fase 2 quando giriamo ETL su 15-20 paesi quotidianamente + eventuali backfill storici.

---

## 9. Definition of Done — Fase 0

Stato corrente:
- [x] Scaffold (Task 0) — `package.json`, `tsconfig.json`, `.env.example`, `spikes/README.md` ([commit 307cbb7](#))
- [x] GME PUN (Task 1) — spike + parser + 4 test pass + fixture committata ([commit 56f8179](#))
- [x] GME PSV (Task 2) — spike + parser + 3 test pass + fixture committata ([commit 21e788e](#))
- [x] ENTSO-E (Task 3) — spike + parser + 3 test pass + fixture DE_LU committata ([commit 360402b](#))
- [x] ARERA (Task 4) — spike + parser + 13 test pass + 3 fixture committate ([commit af84197](#))
- [x] Spike report (Task 5) — questo documento (FINAL)

Restano da chiudere prima di passare alla Fase 1:
- [ ] Final code review (review ai 4 spike + report)
- [ ] Merge a `main` + tag git `fase-0-complete`
- [ ] Approvazione esplicita dell'utente per passare alla Fase 1

---

## 10. Riepilogo nuove scoperte vs versione preliminare

Cosa è cambiato fra la versione PRELIMINARY (2026-05-01) e questa versione FINAL (2026-05-04):

- **ENTSO-E ora verified GO**: token ricevuto e funzionante; 3/3 zone testate (DE_LU, FR, IT_NORTH) con HTTP 200, parser stabile, 3 test passing in `tests/parsers/entsoe.test.ts`.
- **ENTSO-E migrato a PT15M (96 punti/giorno)** anziché PT60M (24 punti) come assunto in fase di pianificazione iniziale: la migrazione del day-ahead europeo da granularità oraria a quartoraria (in corso 2025-2026) è già attiva sulle zone testate. Il parser e i test sono stati progettati per tollerare entrambi i regimi + DST.
- **ENTSO-E curveType A03 (sparse points)**: la risposta XML può comprimere prezzi consecutivi uguali in meno di 96 punti (DE_LU 95, IT_NORTH 88 nello spike 2026-05-04). L'ETL Fase 1 deve **espandere la serie sparsa in 96 quarter-hour intervals densi** prima dello storage. Caveat operativo aggiunto in sez. 3.3.
- **ENTSO-E multi-TimeSeries**: una stessa risposta può contenere asta primaria + secondaria — selezione canonica via `auction.type=A01` o `classificationSequence` minore.
- **GME license flip — IMPORTANTE**: la verifica della pagina di registrazione `https://api.mercatoelettrico.org/users/RegistrationForm/RegistrationRequest` ha confermato che la licenza standard rilasciata è **"uso informativo privato"**. Tale clausola NON è compatibile con il caso d'uso Energy Index (sito informativo pubblico veicolo verso energiapro.biz). Conseguenza: l'API ufficiale `api.mercatoelettrico.org` **non è utilizzabile** sotto licenza standard; richiede una licenza commerciale separata negoziata via mail/PEC con GME. **DNN scraping del sito pubblico diventa quindi Plan A** in Fase 1, con l'API ufficiale come Plan B condizionato.
- **Ranges osservati ENTSO-E (2026-05-04 UTC)**: DE_LU −124.62..250.07 €/MWh (mediana 107.57); FR 60.95..163.83 €/MWh (mediana 110.94); IT_NORTH 89.00..199.51 €/MWh (mediana 136.03). Delta IT-DE coerente con la storia: Italia tipicamente più cara, niente prezzi negativi in IT_NORTH.
