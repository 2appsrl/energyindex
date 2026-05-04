# ENTSO-E day-ahead fixture — provenance notes

## File

`entsoe-de-fixture.xml` — risposta XML reale del Restful API ENTSO-E
Transparency Platform per la zona di offerta **DE-LU** (Germany-Luxembourg)
relativa al day-ahead del **2026-05-04 (UTC)**.

## Source URL

URL pattern usato per ottenere il file (token redacted: lo si legge dal `.env`
locale, non commitato):

```
https://web-api.tp.entsoe.eu/api
  ?documentType=A44
  &in_Domain=10Y1001A1001A82H
  &out_Domain=10Y1001A1001A82H
  &periodStart=202605040000
  &periodEnd=202605050000
  &securityToken=<REDACTED>
```

EIC `10Y1001A1001A82H` = bidding zone Germany-Luxembourg (zone unificata
post-2018).

`periodStart` / `periodEnd` sono in **UTC** (formato `YYYYMMDDHHmm`), come
richiesto dall'API. NON e` ora locale italiana / CET.

## Date the data refers to

Day-ahead prices per il **periodo 2026-05-03T22:00Z -> 2026-05-04T22:00Z**
(corrispondente al giorno 2026-05-04 in ora locale CEST = UTC+2).

L'asta day-ahead europea chiude alle 12:00 CET; i prezzi del giorno seguente
vengono pubblicati subito dopo.

## Why DE-LU as canonical fixture

1. **Zona piu` ricca/stabile** del mercato europeo: liquidita` alta, dati
   pubblicati con regolarita`, raramente vuoti.
2. **Range di prezzi realistico ed espressivo**: include sia prezzi negativi
   (eccesso di rinnovabili) sia picchi positivi — utile per validare il parser
   sui boundary case.
3. **Format identico** a quello di tutte le altre zone EU: lo stesso parser
   funziona per IT_NORTH, FR, ES, ecc.

Per questo fixture specifico (2026-05-04):
- 2 TimeSeries (auction principale + secondaria con `classificationSequence
  position` differente)
- Resolution: **PT15M** (15 minuti). Dal 2025 il day-ahead europeo e` migrato
  da granularita` oraria a quartoraria — quindi una giornata standard ha
  **96 punti** (24 × 4) anziche` 24. Il parser tollera 23 / 95 / 96 / 97 punti
  per coprire DST + occasionali points compressi (curveType A03).
- currency=EUR, unit=MWH

## What the test verifies

`tests/parsers/entsoe.test.ts` (3 test cases):

1. **Punti parsati correttamente**: numero di punti compreso fra 23 e 100,
   ogni punto ha `position >= 1`, `price` in range realistico (-200, 2000)
   €/MWh per coprire sia la granularita` oraria sia quartoraria.
2. **Ordinamento per `position`**: il parser deve restituire i punti gia`
   ordinati per `position` crescente (richiesto dai consumatori downstream).
3. **Currency e unit corretti**: `currency === "EUR"`, `unit` matches `/MWH/i`.

I test sono progettati per essere stabili rispetto a:
- transizione PT60M -> PT15M dei mercati europei (in corso 2025-2026);
- DST (23 / 25 punti orari, 92 / 100 punti quartorari);
- variazioni numeriche giornaliere dei prezzi.

## License / attribution

I dati di ENTSO-E Transparency Platform sono pubblicati ex regolamento (EU)
543/2013 ("Transparency Regulation") e sono **liberamente riutilizzabili** per
scopi non commerciali e commerciali, **a condizione** di:

- citare la fonte: **"Source: ENTSO-E Transparency Platform"**
- linkare la home: **https://transparency.entsoe.eu/**
- non rimuovere i metadati di pubblicazione.

Vedi: https://transparency.entsoe.eu/content/static_content/Static%20content/terms%20and%20conditions/terms%20and%20conditions.html

Il file XML qui committato non contiene token, credenziali, dati personali o
altri elementi sensibili — sono solo prezzi pubblici di mercato.
