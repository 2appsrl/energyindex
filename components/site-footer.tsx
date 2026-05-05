export function SiteFooter() {
  return (
    <footer className="border-t mt-16">
      <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground space-y-2">
        <p>
          Fonte: GME — Gestore dei Mercati Energetici. Dati riprodotti per uso
          informativo.
        </p>
        <p>
          © 2026 Energy Index — un progetto di DEA Group.{" "}
          <a href="https://energiapro.biz" className="ml-2 underline">
            Vai a energiapro.biz
          </a>
        </p>
      </div>
    </footer>
  );
}
