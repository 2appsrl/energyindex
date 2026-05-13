---
title: "Domande frequenti — Temperatura Italia"
---

## Perché vedere la temperatura su un sito di prezzi energia?

La temperatura nazionale è il driver numero uno dei consumi gas e elettrici di breve periodo. Quando fa più freddo del normale, salgono i consumi gas per riscaldamento → sale la domanda → sale il PSV. Quando fa più caldo, salgono i consumi elettrici per condizionatori → sale la domanda → sale il PUN. Sapere se la settimana prossima sarà sopra o sotto la media stagionale anticipa di qualche giorno i movimenti di prezzo che vedrai sul PUN/PSV.

## Cosa significa "anomalia stagionale di +2°C vs media 2021-2025"?

L'anomalia stagionale è la differenza fra la temperatura di **oggi** e la temperatura media degli stessi giorni dell'anno negli ultimi 5 anni. Se la card mostra "▲ +2,3 °C", significa che il 14 maggio 2026 è stato 2,3 °C più caldo della media dei 14 maggio dal 2021 al 2025. Se mostra "▼ -1,5 °C", oggi è 1,5 °C più freddo della norma recente. È un indicatore di **anomalia climatica** rispetto al passato vicino, non rispetto a temperature "ideali".

## Come usa il dato chi compra/vende gas all'ingrosso?

I trader confrontano l'anomalia attuale con le previsioni meteo a 10-14 giorni e decidono come muovere il book: posizioni long se aspettano freddo persistente (gas ↑), short se aspettano caldo. Sui mercati europei TTF/PSV si vede una correlazione netta fra anomalia HDD (Heating Degree Days = max(0, 18 - T_media)) e prezzo gas spot.

## Perché media nazionale e non solo "Milano" o "Roma"?

L'Italia ha climi molto diversi: Milano ha inverni rigidi, Palermo no. Per stimare i **consumi nazionali** serve una media pesata per la popolazione, non un'unica città. Energy Index usa 9 città (Milano, Roma, Napoli, Torino, Bologna, Firenze, Bari, Palermo, Verona) pesate per popolazione: la media risultante riflette grosso modo il consumo nazionale di gas/elettrico in funzione del meteo.

## Gli HDD e CDD: cosa sono?

HDD = Heating Degree Days = max(0, 18 - T media). Quantifica "quanto è freddo" oggi (più HDD = più riscaldamento). CDD = Cooling Degree Days = max(0, T media - 21). Quantifica "quanto è caldo" (più CDD = più condizionamento). Sono usati da assicurazioni weather, utility e trader per modellare consumi. Per ora Energy Index mostra solo la T media; HDD/CDD potrebbero essere aggiunti in futuro se utili per modelli predittivi.
