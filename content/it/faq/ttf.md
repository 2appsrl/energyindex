---
title: "Domande frequenti — TTF Gas Europa"
---

## Cos'è il TTF e perché è il riferimento europeo del gas?

Il **TTF** (Title Transfer Facility) è l'hub virtuale del gas naturale gestito da Gasunie nei Paesi Bassi. È il punto di scambio più liquido d'Europa per il gas: tutte le grandi compagnie energetiche europee tradano qui i contratti per la consegna futura. Il prezzo del **future front-month** (consegna il mese successivo) quotato su ICE Endex è il benchmark che la stampa cita quando dice "il gas in Europa costa X €/MWh".

## Che differenza c'è fra TTF e PSV?

Sono entrambi hub del gas in EUR/MWh, ma a livelli diversi:

- **TTF**: hub continentale europeo (Olanda), liquido, prezzo "di riferimento"
- **PSV**: hub italiano (Snam), insegue il TTF con uno spread di 1-3 €/MWh in più (gas più caro in Italia per costi di trasporto attraverso le pipeline da Nord Europa o LNG da Sud)

Lo spread PSV − TTF si chiama "premio Italia". Se diventa molto alto significa che c'è scarsità relativa di gas in Italia (es. import ridotti, freddo localizzato).

## Perché monitorare il TTF se ho già il PSV?

Tre motivi:
1. **Anticipazione**: il TTF si muove di solito 1-2 giorni prima del PSV (è più liquido, reagisce alle news in tempo reale)
2. **Validazione**: se PSV diverge molto dal TTF, è uno scollamento anomalo che spesso si chiude in pochi giorni
3. **Macro**: il TTF reagisce alle dinamiche globali (LNG, scorte EU, geopolitica), non solo italiane

## Cosa è successo al TTF nel 2022?

Crisi gas russo-ucraina. Il TTF ha toccato **340 €/MWh** ad agosto 2022 (vs 15-25 €/MWh "normali"). Il PSV ha seguito con spread vicino a 0 (gas scarso ovunque in Europa). Dal 2023 il TTF è progressivamente sceso grazie a maggiore import LNG dall'USA/Qatar e riduzione consumi industriali EU.

## Fonte e affidabilità dei dati

Usiamo Yahoo Finance API per il simbolo `TTF=F` (front-month future, quotato sia ICE Endex Amsterdam sia mirror NYMEX). Aggiornamento giornaliero alla chiusura del mercato europeo (~17:00 UTC). I prezzi possono differire di pochi centesimi dai bollettini ICE ufficiali a pagamento.
