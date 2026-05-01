# Fixture: gme-pun-fixture.json

- **Source URL (page container):** https://www.mercatoelettrico.org/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN
- **Source URL (data API):** https://www.mercatoelettrico.org/DesktopModules/GmeEsitiPrezziME/API/item/GetMEPrezzi
- **Mercato:** MGP — Mercato del Giorno Prima (day-ahead auction)
- **Granularita:** `h` (hourly, 24 valori)
- **Data flusso (esiti):** 2026-04-30
- **Fetched at:** 2026-05-01 (vedi `fetched_at` nel JSON)
- **Tipologia parametro API:** `PUN` per la serie nazionale; `PrezziZonali` per le 6 zone fisiche.

## Struttura

File JSON con questa forma (combinato dallo spike `spikes/gme-pun.ts`):

```json
{
  "source": "gme-mgp-pun",
  "url_base": "https://www.mercatoelettrico.org",
  "fetched_at": "ISO timestamp",
  "data_date": "2026-04-30",
  "pun": [{ "df": 20260430, "h": 1, "p": 125.644980, "qh": 4 }, ...],
  "zones": {
    "NORD": [{...}], "CNOR": [...], "CSUD": [...],
    "SUD":  [...],   "SICI": [...], "SARD": [...]
  }
}
```

## Anonimizzazione

Nessuna. I prezzi MGP/PUN sono dati pubblici di mercato pubblicati da GME ai sensi delle normative sul mercato elettrico (Reg. UE 2019/943, D.Lgs. 79/1999). Il file non contiene PII né segreti.

## Perché 2026-04-30 e non oggi

2026-04-30 è giovedì lavorativo con divergenza zonale reale fra macroarea Nord (NORD/CNOR ~107.79 €/MWh medio) e Sud + isole (CSUD/SUD/SICI/SARD ~101.81 €/MWh medio). I test del parser verificano sia il conteggio (24 valori × 7 serie) sia che valori distinti per zona vengano correttamente riassegnati alla zona corretta.

Il giorno corrente del run dello spike (2026-05-01, festa del lavoro) restituisce zone perfettamente convergenti — comportamento di mercato reale ma meno utile come fixture.
