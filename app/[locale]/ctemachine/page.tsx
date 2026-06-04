import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { CteMachine, type CteOffer } from "./CteMachine";

interface MarketRow {
  offer_code: string;
  supplier: string;
  commodity: string;
  price_type: string;
  price_value: number | string;
  category_median: number | string;
  pcv_eur_anno: number | string | null;
  creator_role?: string | null;
  source?: string | null;
}

function mapRow(r: MarketRow, fallbackSource: string): CteOffer {
  return {
    codice: r.offer_code,
    vendor: r.supplier,
    commodity: r.commodity as "electricity" | "gas",
    priceType: r.price_type as "fisso" | "variabile",
    price: Number(r.price_value),
    pcvEurAnno: r.pcv_eur_anno === null ? 0 : Number(r.pcv_eur_anno),
    creatorRole: (r.creator_role ?? null) as CteOffer["creatorRole"],
    source: r.source ?? fallbackSource,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "CTE Machine — Slot machine delle offerte luce e gas",
    description:
      "Gioca alla slot machine dell'energia: scegli luce o gas, inserisci il tuo consumo, premi SPIN THAT WHEEL e scopri la migliore offerta sul mercato.",
    openGraph: {
      title: "CTE Machine · Energy Index",
      description:
        "Slot machine dell'energia: trova la migliore offerta luce/gas con un giro di ruota.",
      type: "website",
      locale: "it_IT",
      url: "/it/ctemachine",
    },
  };
}

/**
 * Pagina /it/ctemachine — slot machine delle offerte energetiche.
 * Stessa data source della Market Map (PLACET + Mercato Libero combinati),
 * cosi' chi e' arrivato qui dalla mappa puo' giocare con lo stesso
 * universo di offerte che ha visto.
 */
export default async function CteMachinePage() {
  const supabase = await createServerClient();
  const [placetRes, liberoRes] = await Promise.all([
    supabase.rpc("get_market_map"),
    supabase.rpc("get_market_map_libero"),
  ]);
  const placetOffers = ((placetRes.data ?? []) as MarketRow[]).map((r) =>
    mapRow(r, "arera_placet"),
  );
  const liberoOffers = ((liberoRes.data ?? []) as MarketRow[]).map((r) =>
    mapRow(r, r.source ?? "energiapro_commerciali"),
  );
  const offers = [...placetOffers, ...liberoOffers];

  return <CteMachine offers={offers} />;
}
