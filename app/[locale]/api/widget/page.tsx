import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, KeyRound, Link2, ShieldCheck, Zap } from "lucide-react";
import { API_LANDING_URL } from "@/lib/api/catalog";
import { WidgetConfigurator } from "@/components/api/WidgetConfigurator";
import { breadcrumbList, jsonLdString } from "@/lib/seo/jsonld";

const PAGE_URL = "https://energyindex.it/it/api/widget";
const TITLE = "Widget prezzi energia gratuito per il tuo sito";
const DESCRIPTION =
  "Widget gratuito da incollare nel tuo sito: Energy Index delle offerte luce e gas, PUN e PSV del giorno, aggiornati in automatico. Nessuna chiave, basta il link a Energy Index.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "it_IT", url: "/it/api/widget" },
  twitter: { card: "summary_large_image" },
};

export default function WidgetPage() {
  return (
    <div className="container mx-auto space-y-12 px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbList([
              { name: "Energy Index", url: "https://energyindex.it/it" },
              { name: "API", url: API_LANDING_URL },
              { name: "Widget", url: PAGE_URL },
            ]),
          ),
        }}
      />

      <header className="max-w-3xl space-y-4">
        <Link
          href="/it/api"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline dark:text-violet-400"
        >
          <ArrowLeft className="size-4" /> Panoramica API
        </Link>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300">
            Gratis · senza chiave
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border">
            HTML · una riga di script
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{TITLE}</h1>
        <p className="text-lg text-muted-foreground">
          Scegli il dato, copia lo snippet e incollalo nella pagina: il riquadro si aggiorna da solo con l&apos;ultimo
          valore disponibile. Non serve programmare e non serve una chiave.
        </p>
      </header>

      <WidgetConfigurator />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            icon: Link2,
            title: "Il link resta visibile",
            text: "Lo snippet contiene il link a Energy Index nella riga \"Fonte\". Puoi cambiarne lo stile, ma deve restare visibile: senza un link visibile a energyindex.it il widget non mostra i dati.",
          },
          {
            icon: ShieldCheck,
            title: "Lo controlliamo",
            text: "Il widget verifica il link a ogni caricamento. Chi ha anche una chiave API dichiara la pagina con il link, che verifichiamo ogni settimana.",
          },
          {
            icon: Zap,
            title: "Sempre aggiornato",
            text: "Gli Energy Index si aggiornano con le offerte del Portale ARERA, il PUN ogni giorno dopo il Mercato del Giorno Prima, il PSV a fine giornata.",
          },
        ].map((x) => (
          <div key={x.title} className="rounded-2xl border bg-card p-5">
            <x.icon className="size-6 text-violet-600 dark:text-violet-400" />
            <h2 className="mt-3 font-bold">{x.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{x.text}</p>
          </div>
        ))}
      </section>

      <section className="max-w-3xl space-y-3 rounded-2xl border bg-amber-500/5 p-6">
        <h2 className="text-xl font-black">PUN e PSV: condizioni del GME</h2>
        <p className="text-sm text-muted-foreground">
          PUN e PSV sono dati del Gestore dei Mercati Energetici. Lo snippet di queste varianti cita la fonte
          con la riga &quot;Fonte: Gestore dei Mercati Energetici S.p.A. — via Energy Index&quot;, che non va rimossa. Per gli usi commerciali le
          condizioni del GME richiedono la sua autorizzazione scritta: i dettagli sono nella{" "}
          <Link href="/it/api/docs#licenza" className="font-semibold underline">
            sezione licenza della documentazione
          </Link>
          . Gli Energy Index delle offerte sono elaborazioni nostre e si possono usare anche a fini commerciali con il
          link di attribuzione.
        </p>
      </section>

      <section className="flex flex-col items-start gap-4 rounded-2xl border bg-gradient-to-br from-violet-500/10 to-transparent p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black">Ti servono i dati grezzi?</h2>
          <p className="text-sm text-muted-foreground">
            Con la chiave Developer gratuita hai storico, zone e CSV via API.
          </p>
        </div>
        <Link
          href="/it/api#chiave"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500"
        >
          <KeyRound className="size-4" /> Richiedi la chiave <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
