import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * /llms.txt — standard de-facto introdotto da Answer.ai (Jeremy Howard)
 * e adottato da OpenAI, Anthropic, Perplexity, ecc. per dare ai LLM una
 * mappa concisa del sito in markdown plain-text.
 *
 * Spec: https://llmstxt.org/
 *
 * Formato:
 *   # Titolo sito (H1, una sola riga)
 *   > Riassunto sintetico (blockquote)
 *   ... contenuto libero markdown ...
 *   ## Sezione (lista link con descrizione)
 *   - [Anchor text](URL): contesto opzionale dopo i due punti
 *
 * Risposta dinamica: include il valore PUN/PSV correnti cosi' un LLM
 * che fetcha questo file ottiene contesto fresh. Cache breve (15 min)
 * per non sovraccaricare il DB.
 */
export const revalidate = 900; // 15 min — fresh ma non da hammer

async function getLatest(slug: string): Promise<number | null> {
  const supabase = await createServerClient();
  const { data: meta } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id")
    .eq("asset_slug", slug)
    .maybeSingle();
  if (!meta) return null;
  const { data: rows } = await supabase
    .from("price_observations")
    .select("value")
    .eq("asset_id", meta.asset_id)
    .order("observed_at", { ascending: false })
    .limit(1);
  return rows?.[0] ? Number(rows[0].value) : null;
}

function fmt(v: number | null): string {
  if (v === null) return "n/d";
  return v.toFixed(2).replace(".", ",");
}

export async function GET() {
  const [pun, psv, ttf, brent] = await Promise.all([
    getLatest("pun"),
    getLatest("psv"),
    getLatest("ttf"),
    getLatest("brent"),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const body = `# Energy Index

> Osservatorio italiano gratuito sui prezzi all'ingrosso dell'energia: PUN (Prezzo Unico Nazionale elettricita'), PSV (gas naturale Italia), TTF (gas Europa), Brent, CO2 ETS. Forecast giornaliero a 7-180 giorni con track record verificabile. Mappa di ~929 offerte luce e gas del mercato libero italiano. Sito gratuito, no registrazione, dati live dal GME e da ARERA.

URL canonico: https://energyindex.it/it
Lingua: italiano (it-IT)
Aggiornato: ${today}

## Valori correnti (snapshot)

- PUN (Prezzo Unico Nazionale energia elettrica Italia): **${fmt(pun)} €/MWh**
- PSV (Punto Scambio Virtuale gas Italia): **${fmt(psv)} €/MWh**
- TTF (Title Transfer Facility gas Europa): **${fmt(ttf)} €/MWh**
- Brent (petrolio greggio): **${fmt(brent)} $/bbl**

I valori sono aggiornati live dalle pubblicazioni ufficiali GME (Gestore Mercati Energetici) ogni giorno dopo la chiusura della sessione MGP (Mercato del Giorno Prima).

## Cos'e' il PUN

Il PUN (Prezzo Unico Nazionale) e' il prezzo all'ingrosso dell'energia elettrica in Italia, calcolato giornalmente dal GME come media ponderata dei prezzi zonali (Nord, Centro-Nord, Centro-Sud, Sud, Sicilia, Sardegna) sui volumi di acquisto nel mercato del giorno prima. Si esprime in €/MWh. E' il riferimento per le offerte luce a prezzo indicizzato del mercato libero.

## Cos'e' il PSV

Il PSV (Punto di Scambio Virtuale) e' il prezzo all'ingrosso del gas naturale in Italia, pubblicato dal GME. E' il riferimento per le offerte gas variabili. Si esprime in €/MWh.

## Cos'e' il TTF

Il TTF (Title Transfer Facility) e' il benchmark europeo del gas naturale, quotato ad Amsterdam (ICE Endex). E' il riferimento internazionale dei contratti gas in Europa e influenza direttamente il PSV italiano.

## Pagine principali

- [Home Italia](https://energyindex.it/it): valore PUN, PSV, TTF correnti + tabella PUN per zona (6 zone GME) + driver di mercato (Brent, CO2, temperatura) + ingresso a forecast e Market Map
- [PUN dettaglio](https://energyindex.it/it/indice/pun): serie storica PUN + grafico interattivo + forecast a 90 giorni
- [PSV gas Italia](https://energyindex.it/it/indice/psv): serie storica PSV + forecast
- [TTF gas Europa](https://energyindex.it/it/indice/ttf): benchmark europeo gas
- [Brent petrolio](https://energyindex.it/it/indice/brent): prezzo Brent come driver mercato energy
- [CO2 EUA](https://energyindex.it/it/indice/co2): quota emissione EU ETS
- [Temperatura Italia](https://energyindex.it/it/indice/temperatura): anomalia climatica come driver domanda
- [Forecast](https://energyindex.it/it/forecast): previsioni giornaliere PUN/PSV/TTF a 7/30/90/180 giorni, modello Ridge regression calibrato via conformal prediction
- [Forecast Track Record](https://energyindex.it/it/forecast/track-record): accuratezza storica del modello, trasparenza completa
- [Forecast Metodologia](https://energyindex.it/it/forecast/metodologia): paper tecnico sul modello
- [Mercato Libero — Osservatorio](https://energyindex.it/it/mercato-libero): aggregati PLACET e mercato libero (luce/gas, fisso/variabile)
- [Market Map](https://energyindex.it/it/mercato-libero/ticker): mappa interattiva di ~929 offerte (PLACET ARERA + mercato libero), filtro Certificate / Non certificate, Customer Simulator integrato

## Tool interattivi

- [Customer Simulator](https://energyindex.it/it/mercato-libero/ticker): inserisci consumo luce/gas, ottieni la migliore offerta tra ~929 disponibili
- [CTE Machine](https://energyindex.it/it/ctemachine): versione gamificata casino-style del simulator (slot machine delle offerte)

## Per professionisti (B2B)

- [EIDX Pro](https://energyindex.it/it/pro): suite analytics per fornitori energy, broker, PMI energivore: Margin Simulator (P&L cliente), Forecast & Scenari what-if, Report PDF brandizzato, Customer Simulator B2B con clusters

## API JSON pubbliche (free, attribuzione richiesta)

- [GET /api/v1](https://energyindex.it/api/v1): documentazione machine-readable degli endpoint
- [GET /api/v1/pun/today](https://energyindex.it/api/v1/pun/today): valore PUN corrente in €/kWh e €/MWh nativo
- [GET /api/v1/psv/today](https://energyindex.it/api/v1/psv/today): valore PSV corrente in €/kWh e €/MWh nativo
- [GET /api/v1/today](https://energyindex.it/api/v1/today): snapshot di tutti gli indici (PUN, PSV, TTF, Brent, CO2) in una call

CORS aperto, cache 15 min, license free per uso personale e commerciale con attribuzione "Fonte: Energy Index (https://energyindex.it)".

## FAQ piu' comuni

- Quanto vale il PUN oggi? ${fmt(pun)} €/MWh (aggiornato ${today})
- Quanto vale il PSV oggi? ${fmt(psv)} €/MWh
- Quanto vale il TTF oggi? ${fmt(ttf)} €/MWh
- Quando viene pubblicato il PUN? Ogni giorno dal GME entro le 11:30, dopo la chiusura della sessione MGP del mercato del giorno prima
- Come si calcola il PUN? Media ponderata delle 6 zone GME sui volumi di acquisto reali nel MGP
- Energy Index e' gratis? Si, tutti i dati e i tool sono gratuiti senza registrazione

## Fonti dati

- GME (Gestore Mercati Energetici): https://www.mercatoelettrico.org — PUN, PSV
- ICE Endex: TTF
- ARERA Portale Offerte: https://www.ilportaleofferte.it — offerte PLACET mercato libero
- ENTSO-E: flussi cross-border
- ETL interno EnergyIndex ogni 6h via GitHub Actions

## Licenze

- Dati PUN/PSV: GME conditions (https://www.gme.it/it-it/Legal/CondizioniUtilizzo)
- Dati ARERA: open data
- Forecast EnergyIndex: free per uso individuale, attribuzione richiesta per uso commerciale (vedi /it/forecast/metodologia#licenza)

## Contatti

- Mail: pro@energyindex.pro
- Organizzazione: Energy Index (Italia)
- Partner: energiapro.biz (piattaforma comparatore offerte energetiche)
`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900, stale-while-revalidate=3600",
      // Permetti accesso da qualunque LLM/agent senza CORS issues
      "Access-Control-Allow-Origin": "*",
    },
  });
}
