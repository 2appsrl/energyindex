/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiKeyRequestForm } from "@/components/api/ApiKeyRequestForm";
import { requestApiKey } from "@/app/actions/request-api-key";

vi.mock("@/app/actions/request-api-key", () => ({ requestApiKey: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

const button = () => screen.getByRole("button", { name: /Richiedi la chiave/ });
const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillValid() {
  type("Nome e cognome", "Ada Rossi");
  type("Email", "ada@esempio.it");
  type("Dominio del sito", "esempio.it");
  type("Pagina dove mostri i dati", "https://esempio.it/prezzi");
  type("Cosa vuoi costruire?", "Widget prezzi per il blog");
}

describe("ApiKeyRequestForm", () => {
  beforeEach(() => {
    vi.mocked(requestApiKey).mockReset();
  });
  afterEach(cleanup);

  it("a form vuoto non mostra elenchi di campi mancanti", () => {
    render(<ApiKeyRequestForm />);
    expect(button()).toBeDisabled();
    expect(screen.queryByText(/Per richiedere la chiave manca/)).not.toBeInTheDocument();
  });

  it("appena si inizia a compilare, dice cosa tiene spento il pulsante", () => {
    render(<ApiKeyRequestForm />);
    type("Cosa vuoi costruire?", "prova");
    const hint = screen.getByText(/Per richiedere la chiave manca/);
    expect(hint).toHaveTextContent("ancora 5 caratteri");
    expect(hint).toHaveTextContent("nome e cognome");
    expect(hint).toHaveTextContent("un'email valida");
    expect(hint).toHaveTextContent("il dominio del sito");
    expect(hint).toHaveTextContent("https://");
  });

  it("per i piani a pagamento non chiede dominio e pagina", () => {
    render(<ApiKeyRequestForm />);
    fireEvent.click(screen.getByRole("radio", { name: /API/ }));
    type("Nome e cognome", "Ada Rossi");
    const hint = screen.getByText(/Per richiedere la chiave manca/);
    expect(hint).not.toHaveTextContent("il dominio del sito");
    expect(hint).not.toHaveTextContent("https://");
  });

  it("con tutti i campi validi il suggerimento sparisce e il pulsante si accende", () => {
    render(<ApiKeyRequestForm />);
    fillValid();
    expect(screen.queryByText(/Per richiedere la chiave manca/)).not.toBeInTheDocument();
    expect(button()).toBeEnabled();
  });

  it("se l'azione del server fallisce (pagina vecchia dopo un deploy) non crasha: invita a ricaricare", async () => {
    vi.mocked(requestApiKey).mockRejectedValue(new Error("Failed to find Server Action"));
    render(<ApiKeyRequestForm />);
    fillValid();
    fireEvent.click(button());
    await waitFor(() => expect(screen.getByText(/Ricaricala e riprova/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Ricarica la pagina" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@esempio.it");
  });
});
