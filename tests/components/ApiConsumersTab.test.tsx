/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApiConsumersTab } from "@/components/admin/ApiConsumersTab";
import { consumerSources, identifiedApiCalls, trafficTop } from "@/lib/admin/queries";

vi.mock("@/lib/admin/queries", () => ({ consumerSources: vi.fn(), identifiedApiCalls: vi.fn(), trafficTop: vi.fn() }));

const call = (origin_host: string, path = "/api/v1/pun/today") => ({
  ts: "2026-11-05T15:00:00+00:00",
  path,
  query: null,
  origin_host,
  referer_host: null,
  api_key_prefix: null,
  ip_hash: origin_host,
});

describe("ApiConsumersTab", () => {
  beforeEach(() => {
    vi.mocked(consumerSources).mockResolvedValue({ data: [], error: null });
  });
  afterEach(cleanup);

  it("mostra se la fonte e' visibile, e cosa significa quando non si trova", async () => {
    vi.mocked(identifiedApiCalls).mockResolvedValue({
      data: { rows: [call("www.casadocimmobiliare.it"), call("marcopadulano.it"), call("nuovosito.it")], truncated: false },
      error: null,
    });
    vi.mocked(trafficTop).mockResolvedValue({ data: [], error: null });
    vi.mocked(consumerSources).mockResolvedValue({
      data: [
        { site: "casadocimmobiliare.it", status: "assente", checked_at: "2026-11-05T15:00:00Z" },
        { site: "marcopadulano.it", status: "link", checked_at: "2026-11-05T15:00:00Z" },
      ],
      error: null,
    });
    render(await ApiConsumersTab({ days: 7 }));

    expect(screen.getByText("Non trovata")).toBeInTheDocument();
    expect(screen.getByText("Link presente")).toBeInTheDocument();
    expect(screen.getByText("Da controllare")).toBeInTheDocument();
    expect(screen.getByText(/caricano la fonte via JavaScript/)).toBeInTheDocument();
  });

  it("se la tabella dei controlli manca l'elenco dei siti resta visibile", async () => {
    vi.mocked(identifiedApiCalls).mockResolvedValue({ data: { rows: [call("nuovosito.it")], truncated: false }, error: null });
    vi.mocked(trafficTop).mockResolvedValue({ data: [], error: null });
    vi.mocked(consumerSources).mockResolvedValue({ data: null, error: "tabella mancante" });
    render(await ApiConsumersTab({ days: 7 }));

    expect(screen.getByRole("link", { name: "nuovosito.it" })).toBeInTheDocument();
    expect(screen.getByText("Da controllare")).toBeInTheDocument();
  });

  it("mostra i siti che chiamano le API con link ed endpoint, e i programmi a parte", async () => {
    vi.mocked(identifiedApiCalls).mockResolvedValue({
      data: { rows: [call("www.casadocimmobiliare.it"), call("marcopadulano.it", "/api/v1/psv/today")], truncated: false },
      error: null,
    });
    vi.mocked(trafficTop).mockResolvedValue({
      data: [
        { label: "Java #905201", requests: 11177, uniques: 1, first_seen: "2026-11-05T00:00:00Z", last_seen: "2026-11-05T15:00:00Z" },
        { label: "marcopadulano.it", requests: 1, uniques: 1, first_seen: "2026-11-05T00:00:00Z", last_seen: "2026-11-05T15:00:00Z" },
      ],
      error: null,
    });
    render(await ApiConsumersTab({ days: 7 }));

    expect(screen.getByRole("link", { name: "casadocimmobiliare.it" })).toHaveAttribute("href", "https://casadocimmobiliare.it");
    expect(screen.getByRole("link", { name: "marcopadulano.it" })).toBeInTheDocument();
    expect(screen.getByText(/\/psv\/today/)).toBeInTheDocument();
    expect(screen.getByText("Java #905201")).toBeInTheDocument();
  });

  it("senza siti lo dice, e un errore del DB non rompe la pagina", async () => {
    vi.mocked(identifiedApiCalls).mockResolvedValue({ data: null, error: "tabella mancante" });
    vi.mocked(trafficTop).mockResolvedValue({ data: [], error: null });
    render(await ApiConsumersTab({ days: 7 }));
    expect(screen.getByText(/tabella mancante/)).toBeInTheDocument();
  });
});
