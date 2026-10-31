/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeSupabase } from "./fake-supabase";

const createServiceClient = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => createServiceClient() }));

const sendMock = vi.fn<(msg: unknown) => Promise<{ data: { id: string }; error: null }>>(async () => ({
  data: { id: "x" },
  error: null,
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (msg: unknown) => sendMock(msg) };
  },
}));

const { startDeveloperRequest, activateDeveloperKey, sanitizeName } = await import("@/lib/api-keys/issue");

const req = {
  nome: "Giovanni",
  email: "G@Esempio.it",
  dominio: "esempio.it",
  attributionUrl: "https://esempio.it/prezzi",
  progetto: "Widget PUN sul blog",
};

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  sendMock.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sanitizeName", () => {
  it("toglie a capo e caratteri di controllo e taglia a 100 caratteri", () => {
    expect(sanitizeName("Mario\r\nBcc: x@y.it")).toBe("Mario Bcc: x@y.it");
    expect(sanitizeName("  A\u0000B\tC  ")).toBe("A B C");
    expect(sanitizeName("x".repeat(150))).toHaveLength(100);
  });
});

describe("startDeveloperRequest", () => {
  it("tetto globale: 30 richieste nell'ultima ora → servizio non disponibile, nessun'altra query", async () => {
    const { db, queries } = fakeSupabase([{ count: 30, error: null }]);
    createServiceClient.mockReturnValue(db);
    const r = await startDeveloperRequest(req, "esempio.it");
    expect(r).toMatchObject({ ok: false, retry: true });
    expect(queries).toHaveLength(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("errore nel conteggio globale → servizio non disponibile", async () => {
    const { db } = fakeSupabase([{ count: null, error: { message: "relation does not exist" } }]);
    createServiceClient.mockReturnValue(db);
    expect(await startDeveloperRequest(req, "esempio.it")).toMatchObject({ ok: false, retry: true });
  });

  it("3 richieste per la stessa email nelle 24 ore → errore senza retry", async () => {
    const { db } = fakeSupabase([{ count: 5, error: null }, { count: 3, error: null }]);
    createServiceClient.mockReturnValue(db);
    const r = await startDeveloperRequest(req, "esempio.it");
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty("retry");
    expect(!r.ok && r.error).toMatch(/Troppe richieste per questo indirizzo/);
  });

  it("percorso completo: insert e email con il nome ripulito", async () => {
    const { db, queries } = fakeSupabase([
      { count: 0, error: null },
      { count: 0, error: null },
      { data: [], error: null },
      { data: { id: "u1" }, error: null },
    ]);
    createServiceClient.mockReturnValue(db);
    const r = await startDeveloperRequest({ ...req, nome: "Gio\r\nvanni" }, "esempio.it");
    expect(r).toEqual({ ok: true });
    const insert = queries[3].ops.find(([op]) => op === "insert")?.[1][0] as Record<string, unknown>;
    expect(insert).toMatchObject({ email: "g@esempio.it", nome: "Gio vanni", domain: "esempio.it" });
    const msg = sendMock.mock.calls[0][0] as { to: string; text: string };
    expect(msg.to).toBe("g@esempio.it");
    expect(msg.text).toContain("Ciao Gio vanni,");
  });
});

describe("activateDeveloperKey", () => {
  const TOKEN = "Ab3dEfGh1jKlMnOpQrStUvWxYz012345";
  const row = {
    id: "u1",
    email: "g@esempio.it",
    nome: "Giovanni",
    domain: "esempio.it",
    attribution_url: "https://esempio.it/prezzi",
    status: "pending",
    verify_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  };

  it("violazione di unicita' (23505) → messaggio dedicato", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<p>niente</p>", { status: 200 })));
    const { db } = fakeSupabase([
      { data: row, error: null },
      { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
    ]);
    createServiceClient.mockReturnValue(db);
    expect(await activateDeveloperKey(TOKEN)).toEqual({
      ok: false,
      error: "Esiste già una chiave attiva per questo dominio con questo indirizzo.",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("controlla il link con un budget di 5 s", async () => {
    const f = vi.fn(async () => new Response('<a href="https://energyindex.it">x</a>', { status: 200 }));
    vi.stubGlobal("fetch", f);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const { db } = fakeSupabase([{ data: row, error: null }, { data: [{ id: "u1" }], error: null }]);
    createServiceClient.mockReturnValue(db);
    const r = await activateDeveloperKey(TOKEN);
    expect(r).toMatchObject({ ok: true, linkFound: true, domain: "esempio.it" });
    expect(timeout).toHaveBeenCalledWith(5_000);
    timeout.mockRestore();
  });
});
