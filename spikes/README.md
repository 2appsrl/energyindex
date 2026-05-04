# Spikes — Fase 0 fonti dati

Questa cartella contiene script standalone investigativi per verificare l'accessibilità delle 4 fonti dati pubbliche del progetto Energy Index (GME PUN, GME PSV, ENTSO-E day-ahead, ARERA Portale Offerte).

NON è codice di produzione. Serve solo a:
1. Confermare che le fonti sono accessibili senza autenticazione (o con quale autenticazione).
2. Capire il formato esatto delle risposte.
3. Salvare campioni reali in `samples/` da usare come fixture nei test di Fase 1.
4. Produrre un report finale `../docs/plans/2026-05-01-spike-report.md` con decisione go/plan-B.

## Eseguire uno spike

```bash
cp .env.example .env  # solo la prima volta, popolare con token reale
npm run spike:gme-pun
npm run spike:gme-psv
npm run spike:entsoe   # richiede ENTSOE_API_TOKEN in .env
npm run spike:arera
```

## Output

- `samples/raw/` — risposte raw scaricate (gitignored, non committate)
- `samples/fixtures/` — sample anonimizzati committati come fixture test
- `reports/` — output testuale di ogni run con timestamp
