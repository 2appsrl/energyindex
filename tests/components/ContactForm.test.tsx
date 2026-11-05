/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContactForm } from "@/components/pro/ContactForm";
import { sendContactEmail } from "@/app/actions/send-contact-email";

vi.mock("@/app/actions/send-contact-email", () => ({ sendContactEmail: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

const MESSAGGIO = "Ci servono i benchmark per 40 agenti & più canali";

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/Nome e cognome/), { target: { value: "Ada Rossi" } });
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "ada@esempio.it" } });
  fireEvent.change(screen.getByLabelText(/Messaggio/), { target: { value: MESSAGGIO } });
  fireEvent.click(screen.getByRole("button", { name: /Invia messaggio/ }));
}

describe("ContactForm", () => {
  beforeEach(() => {
    vi.mocked(sendContactEmail).mockReset();
  });
  afterEach(cleanup);

  it("se l'azione del server fallisce (pagina vecchia dopo un deploy) non crasha e il messaggio non va perso", async () => {
    vi.mocked(sendContactEmail).mockRejectedValue(new Error("Failed to find Server Action"));
    render(<ContactForm />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText(/potrebbe essere stata aggiornata/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Ricarica la pagina" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Messaggio/)).toHaveValue(MESSAGGIO);

    const href = screen.getByRole("link", { name: /client email/ }).getAttribute("href") ?? "";
    expect(href.startsWith("mailto:pro@energyindex.pro?")).toBe(true);
    const body = new URLSearchParams(href.split("?")[1].replace(/\+/g, "%2B")).get("body");
    expect(body).toContain(MESSAGGIO);
    expect(body).toContain("ada@esempio.it");
  });

  it("un errore restituito dal server continua a mostrare il suo messaggio, senza invito a ricaricare", async () => {
    vi.mocked(sendContactEmail).mockResolvedValue({ ok: false, error: "Servizio non disponibile" });
    render(<ContactForm />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Servizio non disponibile")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Ricarica la pagina" })).not.toBeInTheDocument();
  });

  it("a invio riuscito mostra la conferma", async () => {
    vi.mocked(sendContactEmail).mockResolvedValue({ ok: true });
    render(<ContactForm />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Messaggio inviato!")).toBeInTheDocument());
  });
});
