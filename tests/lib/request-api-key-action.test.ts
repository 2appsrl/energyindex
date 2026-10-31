/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const saveLead = vi.fn<(lead: unknown) => Promise<void>>(async () => {});
vi.mock("@/lib/admin/leads", () => ({ saveLead: (lead: unknown) => saveLead(lead) }));

const startDeveloperRequest = vi.fn();
vi.mock("@/lib/api-keys/issue", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api-keys/issue")>();
  return { ...real, startDeveloperRequest: (...a: unknown[]) => startDeveloperRequest(...a) };
});

const sendMock = vi.fn<(msg: unknown) => Promise<{ data: { id: string }; error: null }>>(async () => ({
  data: { id: "x" },
  error: null,
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (msg: unknown) => sendMock(msg) };
  },
}));

const { requestApiKey } = await import("@/app/actions/request-api-key");

const dev = {
  nome: "Giovanni",
  email: "g@esempio.it",
  piano: "developer" as const,
  progetto: "Widget PUN sul blog",
  dominio: "esempio.it",
  attributionUrl: "https://esempio.it/prezzi",
};

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  saveLead.mockClear();
  startDeveloperRequest.mockReset();
  sendMock.mockClear();
});

describe("requestApiKey", () => {
  it("honeypot compilato: successo silenzioso, niente lead, niente email", async () => {
    expect(await requestApiKey({ ...dev, hp: "https://spam.example" })).toEqual({ ok: true, mode: "verify" });
    expect(await requestApiKey({ ...dev, piano: "api", hp: "x" })).toEqual({ ok: true, mode: "manual" });
    expect(saveLead).not.toHaveBeenCalled();
    expect(startDeveloperRequest).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("lead salvato solo dopo una richiesta riuscita o fallita per guasto", async () => {
    startDeveloperRequest.mockResolvedValueOnce({ ok: true });
    expect(await requestApiKey(dev)).toEqual({ ok: true, mode: "verify" });
    expect(saveLead).toHaveBeenCalledTimes(1);

    startDeveloperRequest.mockResolvedValueOnce({ ok: false, error: "Servizio", retry: true });
    const r = await requestApiKey(dev);
    expect(r).toMatchObject({ ok: false, fallbackMailto: expect.stringContaining("mailto:") });
    expect(saveLead).toHaveBeenCalledTimes(2);
  });

  it("tetto globale raggiunto: fallback manuale ma nessun lead", async () => {
    startDeveloperRequest.mockResolvedValueOnce({ ok: false, error: "Servizio", retry: true, capped: true });
    const r = await requestApiKey(dev);
    expect(r).toMatchObject({ ok: false, fallbackMailto: expect.stringContaining("mailto:") });
    expect(saveLead).not.toHaveBeenCalled();
  });

  it("niente lead per limite o duplicato", async () => {
    startDeveloperRequest.mockResolvedValueOnce({ ok: false, error: "Troppe richieste per questo indirizzo" });
    const r = await requestApiKey(dev);
    expect(r).toEqual({ ok: false, error: "Troppe richieste per questo indirizzo" });
    expect(saveLead).not.toHaveBeenCalled();
  });

  it.each([
    ["payload nullo", null],
    ["nome numerico", { ...dev, nome: 123 }],
    ["email oggetto", { ...dev, email: { a: 1 } }],
    ["azienda numerica", { ...dev, azienda: 5 }],
    ["progetto array", { ...dev, progetto: ["x".repeat(20)] }],
    ["dominio numerico", { ...dev, dominio: 7 }],
    ["pagina nulla", { ...dev, attributionUrl: null }],
    ["piano sconosciuto", { ...dev, piano: "toString" }],
  ])("input malformato (%s): errore, nessuna eccezione", async (_label, payload) => {
    const r = await requestApiKey(payload as never);
    expect(r.ok).toBe(false);
    expect(startDeveloperRequest).not.toHaveBeenCalled();
    expect(saveLead).not.toHaveBeenCalled();
  });

  it.each([
    ["nome", { nome: "x".repeat(101) }, /Nome troppo lungo/],
    ["email", { email: `${"a".repeat(250)}@b.it` }, /email troppo lungo/],
    ["azienda", { azienda: "x".repeat(201) }, /troppo lung/],
  ])("limite di lunghezza su %s", async (_f, patch, msg) => {
    const r = await requestApiKey({ ...dev, ...patch });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(msg);
  });

  it("piani manuali: oggetto dell'email senza a capo nel nome", async () => {
    expect(await requestApiKey({ ...dev, piano: "api", nome: "Mario\r\nBcc: x@y.it" })).toEqual({ ok: true, mode: "manual" });
    const msg = sendMock.mock.calls[0][0] as { subject: string };
    expect(msg.subject).not.toMatch(/[\r\n]/);
  });
});
