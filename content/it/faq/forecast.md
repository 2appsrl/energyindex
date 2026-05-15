---
title: "Domande frequenti — Forecast"
---

## Come funzionano le previsioni di Energy Index?

Usiamo un modello statistico **Ridge regression** addestrato giornalmente sulle ultime serie storiche di PUN, PSV, TTF e dei loro principali driver (gas TTF, petrolio Brent, CO2 ETS, temperatura italiana). Per ogni asset e ogni orizzonte (7/30/90/180 giorni) addestriamo un modello indipendente con ~35 feature: lag autoregressivi, lag cross-asset, indicatori meteo (HDD/CDD), calendario e stagionalità ciclica.

Il modello produce un valore puntuale e una banda di confidenza 5–95% calibrata con **split conformal prediction**. Tutta la metodologia è pubblica: [vedi la specifica tecnica](/it/forecast/metodologia).

## Quanto sono accurate? Posso fidarmi per decisioni reali?

L'accuratezza dipende da asset e orizzonte. Le metriche aggiornate giornalmente sono nella [dashboard track record](/it/forecast/track-record): MAPE (errore percentuale), RMSE, hit ratio (direzione indovinata) e coverage della banda.

Indicativamente, su 90 giorni di backtesting:
- **7 giorni**: MAPE tipicamente 3-5%
- **30 giorni**: MAPE tipicamente 5-8%
- **90 giorni**: MAPE tipicamente 8-12%
- **180 giorni**: MAPE tipicamente 12-18%

Sono forecast informativi gratuiti. **Non sono consulenza finanziaria** e non sostituiscono analisi professionale per decisioni di copertura o trading. Per uso commerciale strutturato vedi [EIDX Pro](mailto:commerciale@deagroup.biz).

## Cosa significa banda di confidenza 5–95%?

Il modello non emette un solo numero ma un **intervallo plausibile**. La banda 5–95% significa: in passato, sui dati di calibrazione, il valore reale è caduto dentro questa banda nel ~90% dei casi.

Banda larga = molta incertezza (es. forecast a 180g, mercato volatile). Banda stretta = poca incertezza (es. forecast a 7g, mercato stabile).

## Perché il forecast a 180 giorni è meno preciso di quello a 7 giorni?

Più si guarda lontano nel futuro, più rumore entra: nuovi shock geopolitici, cambi di scenario meteo a lungo termine, decisioni di policy. I modelli statistici tradizionali (incluso Ridge) catturano pattern, non eventi esogeni. La banda di confidenza si allarga automaticamente per riflettere questa incertezza crescente.

## Posso usare i forecast a fini commerciali o decisioni di copertura?

I forecast pubblici di Energy Index sono **gratuiti per uso informativo, accademico e personale**. Uso commerciale (ridistribuzione, integrazione in prodotti propri, alert email automatici a clienti) richiede autorizzazione scritta.

Se sei un fornitore energetico, broker o PMI energivora che vuole forecast a 24 mesi, scenari "what-if" personalizzati, API access o margin simulator integrato, contatta [commerciale@deagroup.biz](mailto:commerciale@deagroup.biz) per il piano EIDX Pro.
