import type { Metadata } from "next";
import { breadcrumbList, jsonLdString, techArticle } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Metodologia forecast — Energy Index",
  description:
    "Specifica tecnica del modello forecast di Energy Index: Ridge regression con feature engineering esteso, banda di confidenza via split conformal prediction, validazione walk-forward.",
  openGraph: {
    title: "Metodologia forecast — Energy Index",
    description: "Come funzionano le previsioni PUN/PSV/TTF di Energy Index.",
    type: "article",
    locale: "it_IT",
    url: "/it/forecast/metodologia",
  },
};

const PUBLISHED = "2026-05-15";

export default function MetodologiaPage() {
  return (
    <article className="container mx-auto max-w-3xl px-4 py-12 prose prose-neutral dark:prose-invert">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            techArticle({
              headline: "Metodologia forecast Energy Index",
              description:
                "Specifica tecnica del modello forecast Ridge regression + conformal prediction.",
              url: "https://energyindex.it/it/forecast/metodologia",
              author: "EIDX Research",
              datePublished: PUBLISHED,
              keywords: ["forecast", "Ridge regression", "conformal prediction", "energia", "metodologia"],
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbList([
              { name: "Home", url: "https://energyindex.it/it" },
              { name: "Forecast", url: "https://energyindex.it/it/forecast" },
              { name: "Metodologia", url: "https://energyindex.it/it/forecast/metodologia" },
            ]),
          ),
        }}
      />

      <header>
        <h1>Metodologia dei forecast Energy Index</h1>
        <p className="lead">
          Documento tecnico pubblico — versione 1.0, pubblicato il {PUBLISHED}.
        </p>
      </header>

      <h2 id="obiettivo">1. Obiettivo</h2>
      <p>
        Fornire previsioni giornaliere di PUN, PSV e TTF a 7, 30, 90 e 180 giorni con una stima esplicita dell&apos;incertezza, completamente trasparenti e verificabili.
      </p>

      <h2 id="modello">2. Famiglia di modello</h2>
      <p>
        Adottiamo <strong>Ridge regression</strong> (regressione lineare regolarizzata L2) come baseline interpretabile. Rispetto a una semplice OLS, Ridge:
      </p>
      <ul>
        <li>stabilizza i coefficienti in presenza di feature correlate (lag autoregressivi, cross-asset);</li>
        <li>permette di mantenere ~35 feature senza overfitting;</li>
        <li>produce coefficienti interpretabili → driver attribution naturale.</li>
      </ul>
      <p>
        Il valore di regolarizzazione <code>λ</code> è fissato a <code>1.0</code> sulle feature standardizzate. Validato empiricamente su backtesting walk-forward.
      </p>

      <h2 id="features">3. Feature engineering</h2>
      <p>Per ogni asset target e ogni orizzonte alleniamo un modello indipendente con le seguenti feature:</p>
      <ul>
        <li><strong>Autoregressive:</strong> lag 1/7/30 giorni, rolling mean 7/30, rolling std 30.</li>
        <li><strong>Cross-asset:</strong> lag 1/7 di TTF, Brent, CO2 (e PSV per il modello TTF).</li>
        <li><strong>Meteo:</strong> Heating Degree Days e Cooling Degree Days derivati dalla temperatura nazionale italiana (media pesata 9 città).</li>
        <li><strong>Calendar:</strong> giorno della settimana e mese in one-hot encoding; festività italiane via libreria <code>date-holidays</code>.</li>
        <li><strong>Stagionalità ciclica:</strong> seno/coseno annuali e settimanali per evitare discontinuità al cambio di anno.</li>
      </ul>

      <h2 id="confidenza">4. Banda di confidenza</h2>
      <p>
        Usiamo <strong>split conformal prediction</strong>: i residui assoluti del modello vengono calcolati su un set di calibrazione (ultimi 90 giorni di training). Il quantile 0.9 dei residui assoluti definisce la semibanda <code>q</code>, e la previsione è esposta come <code>[value − q, value + q]</code>.
      </p>
      <p>
        Garanzia teorica: assumendo scambiabilità dei residui, il valore reale cade dentro la banda con probabilità ≥ 90% (distribution-free, no assunzione gaussiana).
      </p>

      <h2 id="attribution">5. Driver attribution</h2>
      <p>
        Per ogni forecast esposto, calcoliamo la <em>contribuzione</em> di ogni feature come:
      </p>
      <pre><code>contribution_i = coefficient_i × (feature_oggi_i − feature_media_training_i)</code></pre>
      <p>
        Mostriamo i top 3-4 driver per magnitudine assoluta, raggruppando le feature calendar (dow_*, month_*) e seasonal in un&apos;unica voce.
      </p>

      <h2 id="validazione">6. Validazione</h2>
      <p>
        Il modello è validato in due regimi:
      </p>
      <ol>
        <li><strong>Bootstrap walk-forward (1 volta dopo deploy):</strong> per ogni giorno degli ultimi 12 mesi, addestriamo il modello con i dati disponibili a quel giorno (no leakage) e generiamo forecast a 7/30/90/180g. Otteniamo ~4.000 forecast retrospettivi.</li>
        <li><strong>Daily rolling (live):</strong> ogni giorno emettiamo 12 nuovi forecast (3 asset × 4 horizon), e quando arriva il valore reale ricalcoliamo le metriche aggregate.</li>
      </ol>
      <p>
        Le metriche pubblicate giornalmente sono:
      </p>
      <ul>
        <li><strong>MAPE</strong>: errore percentuale assoluto medio</li>
        <li><strong>RMSE</strong>: errore quadratico medio (radice)</li>
        <li><strong>Hit ratio</strong>: percentuale di direzioni indovinate (up/down vs spot di ieri)</li>
        <li><strong>Coverage 90%</strong>: percentuale di osservazioni reali dentro la banda 5–95%</li>
      </ul>

      <h2 id="limiti">7. Limiti dichiarati</h2>
      <ul>
        <li>Modello lineare: non cattura non-linearità o regime shifts strutturali (es. crisi 2022).</li>
        <li>Univariato di output: ogni asset/orizzonte è un modello indipendente, non c&apos;è coerenza congiunta tra forecast.</li>
        <li>Forecast meteo: per orizzonti &gt;16 giorni usiamo l&apos;ultimo valore osservato come proxy (Open-Meteo fornisce solo 16g forecast).</li>
        <li>Granularità minima: giornaliera. Forecast intra-day non disponibili.</li>
      </ul>

      <h2 id="upgrade-path">8. Roadmap upgrade</h2>
      <p>
        Il modello sarà aggiornato a uno stack più avanzato (Prophet + XGBoost + ARIMAX in ensemble, deployment Python su FastAPI) al verificarsi di almeno 2 di 3 condizioni:
      </p>
      <ul>
        <li>5+ utenti Pro paganti (149€/mese)</li>
        <li>1+ contratto Enterprise firmato</li>
        <li>MAPE a 90 giorni &gt; 12% per 4 settimane consecutive su qualunque asset</li>
      </ul>

      <h2 id="licenza">9. Licenza e citazione</h2>
      <p>
        I forecast pubblicati su <code>energyindex.it</code> sono gratuiti per uso informativo, accademico e personale. Sono espressamente vietati uso commerciale e ridistribuzione senza autorizzazione scritta.
      </p>
      <p>
        Citazione consigliata: &laquo;EIDX Research, Metodologia forecast Energy Index v1.0, {PUBLISHED}, https://energyindex.it/it/forecast/metodologia&raquo;.
      </p>

      <h2 id="contatti">10. Contatti</h2>
      <p>
        Per domande tecniche, segnalazioni di bug o richieste di dataset estesi: <a href="mailto:commerciale@deagroup.biz">commerciale@deagroup.biz</a>.
      </p>
    </article>
  );
}
