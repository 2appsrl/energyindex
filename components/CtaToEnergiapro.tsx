import { Card } from "@/components/ui/card";

export function CtaToEnergiapro({ campaign }: { campaign: string }) {
  const url = `https://energiapro.biz/?utm_source=energy-index&utm_medium=cta&utm_campaign=${encodeURIComponent(campaign)}`;
  return (
    <Card className="p-6 bg-primary/5 border-primary/30">
      <h3 className="text-lg font-semibold">Vuoi una tariffa migliore?</h3>
      <p className="mt-2 text-muted-foreground">
        Confronta tutte le offerte luce e gas del mercato libero su
        energiapro.biz.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="inline-block mt-4 px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90"
      >
        Vai al comparatore →
      </a>
    </Card>
  );
}
