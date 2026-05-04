# Fixture: ARERA Portale Offerte (PLACET CSV + Mercato Libero XML)

## Source

- **Pagina indice (Open Data):** https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page
- **URL data del feed CSV PLACET (snapshot di riferimento 2026-05-01):**
  - Elettrico: https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerte/2026_5/PO_Offerte_E_PLACET_20260501.csv
  - Gas:       https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerte/2026_5/PO_Offerte_G_PLACET_20260501.csv
- **URL data del feed XML Mercato Libero:**
  - Elettrico: https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/2026_5/PO_Offerte_E_MLIBERO_20260501.xml
  - Gas:       https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/2026_5/PO_Offerte_G_MLIBERO_20260501.xml
  - Dual:      https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/2026_5/PO_Offerte_D_MLIBERO_20260501.xml

Aggiornamento: giornaliero, file rigenerati notte (Last-Modified osservato 22:30-23:05 UTC).

## File contenuti

- `arera-offers-placet-e-fixture.csv` — 6 righe + header. 3 prezzo fisso domestico,
  3 prezzo variabile domestico. 26 colonne, separatore `,`, nessuna virgola embedded.
- `arera-offers-placet-g-fixture.csv` — 4 righe + header. 2 prezzo fisso domestico,
  2 prezzo variabile domestico. 21 colonne, separatore `,`.
- `arera-offers-mlibero-fixture.xml` — 2 offerte: 1 elettrico variabile (TIPO_OFFERTA=02)
  + 1 gas fisso (TIPO_OFFERTA=01). Schema namespace
  `http://www.acquirenteunico.it/schemas/SII_AU/OffertaRetail/01`.

## Anonimizzazione

I file open-data ARERA sono in regime "open" ex L. 190/2012 + D.Lgs. 33/2013 (vedi
`spikes/notes/arera-investigation.md`), quindi i dati venditore sarebbero ridistribuibili
anche letteralmente. Tuttavia per evitare di committare nel repo nomi commerciali,
codici fiscali e PIVA reali (vita indipendente del repo, fork pubblici, ecc.), i campi
identificativi sono stati sostituiti con placeholder:

| campo | originale | fixture |
|---|---|---|
| `denominazione` | ragione sociale reale | "Vendor Alpha/Beta/Gamma/Delta srl" |
| `codice_fiscale`, `p_iva` | CF/PIVA reali a 11 cifre | "00000000001" .. "00000000004" |
| `url_sito_venditore`, `url_offerta` | dominio reale | "https://example.org/{alpha\|beta\|...}" |
| `nome_offerta`, `cod_offerta` | nome commerciale + codice ARERA | "FIXTURE_*" e simili |
| `telefono` | numeri reali | vuoto o "0000000000" |

I valori **economici** (`p_fix_f`, `p_fix_v`, `p_vol*`, `alpha`) e i campi
classificatori (`tipo_cliente`, `tipo_offerta`, date validita) sono **identici a riga
reale presa dal feed del 2026-05-01** — il parser viene quindi testato su numeri di forma
e ordini di grandezza realistici.

Per la fixture XML ML, idem: `PIVA_UTENTE`, `COD_OFFERTA`, `TELEFONO`, `URL_SITO_VENDITORE`
sono placeholder; la struttura schema (sequenza tag, codici TIPO_*, ComponenteImpresa con
IntervalloPrezzi per fasce) e fedele al feed reale.

## Cosa testano i test

- Conteggio righe e split-by-comma su 26/21 campi.
- Mapping `tipo_offerta` -> bucket fisso/variabile.
- Selezione del campo prezzo corretto: per ELETTRICO `prezzo fisso` -> `p_vol_mono`,
  `prezzo variabile` -> `alpha`. Per GAS `prezzo fisso` -> `p_vol`, `prezzo variabile`
  -> `alpha`.
- Robustezza: campi vuoti = NaN, sparsi nel record (la fixture include righe con
  campi vuoti realistici).

## Note operative

- **NON aggiornare la fixture in modo automatico**: il refresh giornaliero della sorgente
  e voluto mantenerlo separato dal repo. Se schema cambia, rifare lo spike e aggiornare
  manualmente la fixture.
- **NON committare il sample raw scaricato dallo spike** — `spikes/samples/raw/` e gia
  in `.gitignore`. Solo le fixture anonimizzate vivono nel repo.
