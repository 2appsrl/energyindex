# Fixture: gme-psv-fixture.json

- **Source URL (page container):** https://www.mercatoelettrico.org/it-it/Home/Esiti/Gas/MGP/Esiti
- **Source URL (data API):** https://www.mercatoelettrico.org/DesktopModules/GmeEsitiMGAS/API/item/GetGasEsitiMGAS
- **Mercato:** MGP-GAS (Mercato del Giorno Prima del Gas)
- **Hub:** PSV (Punto di Scambio Virtuale, l'unico hub gas all'ingrosso italiano — nessun parametro `Zona` necessario, è implicito)
- **Granularità:** giornaliera (1 prezzo di riferimento per data di consegna)
- **Sessioni di trading incluse:** 2026-04-25 -> 2026-05-01 (7 sessioni consecutive)
- **Data di fetch:** 2026-05-01 (vedi `fetched_at` nel JSON)
- **API parameters usati:** `DataSessione=YYYYMMDD` + `Mercato=MGP` (uno per call, l'API non accetta range).

## Struttura

File JSON con questa forma (combinato dallo spike `spikes/gme-psv.ts`):

```json
{
  "source": "gme-mgp-gas-psv",
  "url_base": "https://www.mercatoelettrico.org",
  "fetched_at": "ISO timestamp",
  "sessions": [
    {
      "session_date": "2026-04-25",
      "http_status": 200,
      "rows": [
        {
          "data": 20260425,
          "prodotto": "MGP-2026-04-26",
          "firstPrice": 46.5, "lastPrice": 45.0,
          "prezzoMinimo": 44.6, "prezzoMassimo": 46.8,
          "prezzoRiferimento": 45.683533,
          "prezzoControllo": 45.394,
          "prezzoAcquisto": null, "prezzoVendita": null,
          "volumiMW": 750, "volumiMWh": 18000,
          "volumiOTCMW": null, "volumiOTCMWh": null,
          "posizioniAperte": 17280
        },
        ...
      ]
    },
    ...
  ]
}
```

Ogni `rows[i]` rappresenta UN prodotto (non un giorno):
 - `MGP-YYYY-MM-DD`: consegna giornaliera. Per la sessione T il day-ahead è `MGP-(T+1)`.
 - `WD-YYYY-WW`: Within-Day (intraday gas).
 - `WE-YYYY-WW`: weekend (Sab + Dom + Lun) — appare nei venerdì.

## Convenzione PSV daily

Il parser estrae 1 punto per data di consegna scegliendo il prodotto `MGP-(session_date+1)`
e usando `prezzoRiferimento`. È la grandezza che corrisponde concettualmente al
"PUN day-ahead" sul lato gas.

Per il fixture, ci si aspetta 6 punti consegna 2026-04-26 -> 2026-05-01,
in range 44.68 - 46.37 €/MWh (gas wholesale Italia 2026, in linea con TTF + spread Italia).

La sessione 2026-05-01 (Festa del Lavoro) ha rows=0 — l'API restituisce array vuoto:
nel momento del fetch il prezzo per consegna 2026-05-02 non era ancora pubblicato.
Questo è un caso di test importante: il parser deve tollerare sessioni vuote
e dedurre solo i punti effettivamente disponibili.

## Anonimizzazione

Nessuna. I prezzi MGP-GAS / PSV sono dati pubblici di mercato pubblicati da GME ai sensi
delle normative sul mercato gas (Reg. UE 2017/459, D.Lgs. 164/2000, delibera ARERA 312/2016/R/gas).
Il file non contiene PII né segreti.

## Perché 7 sessioni e non 1

7 sessioni danno alla parser-test abbastanza varietà per:
 - verificare che il dedup per data di consegna funziona (in fixture è 1:1, ma il parser
   è scritto per gestire fix-up post-asta dove la stessa consegna riapparirebbe);
 - verificare che le sessioni vuote (es. 2026-05-01 al momento del fetch) non rompono il parser;
 - avere un range realistico (min/max divergenti) per il guard rail dei test.

## Note su API ufficiale GME

A partire dal 15 ottobre 2025 GME ha attivato un canale API ufficiale a
`https://api.mercatoelettrico.org/`, con manuale tecnico:
`https://www.mercatoelettrico.org/Portals/0/Documents/en-US/20251015Manuale_tecnico_API_En.pdf`.
Il canale ufficiale supporta MGP-GAS / PBZ-PSV ma richiede registrazione
(`https://api.mercatoelettrico.org/users/RegistrationForm/RegistrationRequest`)
e copre solo dati dal 1 ottobre 2025 in poi.

Questo fixture è stato generato dal canale **pubblico DNN** (no auth richiesta), che resta
spendibile come fallback / dev sandbox. Per la produzione si dovrà valutare la migrazione
all'API ufficiale.
