/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase } from "./fake-supabase";
import { isUuid, keyStatusBadge, linkBadge, mergeKeyUsage } from "@/lib/admin/integrations";

const requireAdmin = vi.fn<() => Promise<{ email: string }>>();
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: () => requireAdmin() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

const createServiceClient = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => createServiceClient() }));

const fetchHasLink = vi.fn<(url: string, f?: unknown, budget?: number) => Promise<boolean>>();
vi.mock("@/lib/api-keys/link-check", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api-keys/link-check")>();
  return { ...real, fetchHasLink: (url: string, f?: unknown, budget?: number) => fetchHasLink(url, f, budget) };
});

const { revokeApiKey, recheckApiKeyLink } = await import("@/app/actions/admin-api-keys");

const ID = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c";

beforeEach(() => {
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue({ email: "admin@esempio.it" });
  revalidatePath.mockClear();
  createServiceClient.mockReset();
  fetchHasLink.mockReset();
});

// ============================================================ helper puri

describe("isUuid", () => {
  it("accetta UUID in minuscolo e maiuscolo", () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid(ID.toUpperCase())).toBe(true);
  });
  it.each([
    ["numero", 42],
    ["null", null],
    ["oggetto", { id: ID }],
    ["stringa vuota", ""],
    ["spazi attorno", ` ${ID} `],
    ["un carattere in meno", ID.slice(1)],
    ["caratteri non esadecimali", ID.replace("3", "z")],
    ["iniezione PostgREST", `${ID},status.eq.active`],
  ])("rifiuta %s", (_l, v) => {
    expect(isUuid(v)).toBe(false);
  });
});

describe("mergeKeyUsage", () => {
  const keys = [
    { id: "a", prefix: "eidx_live_ab12" },
    { id: "b", prefix: "eidx_live_cd34" },
    { id: "c", prefix: null },
  ];
  it("aggiunge le chiamate per prefisso, zero se assenti o chiave senza prefisso", () => {
    const out = mergeKeyUsage(keys, [{ api_key_prefix: "eidx_live_ab12", requests: "57" as unknown as number }]);
    expect(out.map((k) => k.calls_30d)).toEqual([57, 0, 0]);
    expect(out[0]).toMatchObject({ id: "a", prefix: "eidx_live_ab12" });
  });
  it("conteggio non disponibile (RPC mancante): null su tutte", () => {
    expect(mergeKeyUsage(keys, null).map((k) => k.calls_30d)).toEqual([null, null, null]);
  });
});

describe("keyStatusBadge", () => {
  it.each([
    ["active", "Attiva", "good"],
    ["downgraded", "Declassata", "warn"],
    ["pending", "Da confermare", "neutral"],
    ["revoked", "Revocata", "bad"],
  ] as const)("%s → %s", (status, label, tone) => {
    expect(keyStatusBadge(status)).toEqual({ label, tone });
  });
});

describe("linkBadge", () => {
  it("mai verificato", () => expect(linkBadge(null, null)).toEqual({ label: "Mai verificato", tone: "neutral" }));
  it("link presente", () => expect(linkBadge(true, "2026-10-30T10:00:00Z")).toEqual({ label: "Link ok", tone: "good" }));
  it("link assente", () => expect(linkBadge(false, "2026-10-30T10:00:00Z")).toEqual({ label: "Link assente", tone: "bad" }));
});

// ============================================================ revokeApiKey

describe("revokeApiKey", () => {
  it("non admin: lancia prima di toccare il DB", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(revokeApiKey(ID)).rejects.toThrow("NEXT_REDIRECT");
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([["numero", 1], ["non uuid", "abc"], ["filtro iniettato", `${ID})`]])("id %s: errore, nessuna query", async (_l, id) => {
    const r = await revokeApiKey(id as never);
    expect(r.ok).toBe(false);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("revoca con status e revoked_at, solo se non gia' revocata", async () => {
    const { db, queries } = fakeSupabase([{ data: [{ id: ID }], error: null }]);
    createServiceClient.mockReturnValue(db);
    const r = await revokeApiKey(ID);
    expect(r.ok).toBe(true);
    expect(queries).toHaveLength(1);
    const ops = queries[0].ops;
    expect(queries[0].table).toBe("api_keys");
    const update = ops.find(([op]) => op === "update")?.[1][0] as Record<string, unknown>;
    expect(update.status).toBe("revoked");
    expect(typeof update.revoked_at).toBe("string");
    expect(ops).toContainEqual(["eq", ["id", ID]]);
    expect(ops).toContainEqual(["neq", ["status", "revoked"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/it/admin");
  });

  it("gia' revocata o inesistente: nessuna riga aggiornata → errore", async () => {
    const { db } = fakeSupabase([{ data: [], error: null }]);
    createServiceClient.mockReturnValue(db);
    const r = await revokeApiKey(ID);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/revocata|non trovata/i) });
  });

  it("errore del DB: errore leggibile", async () => {
    const { db } = fakeSupabase([{ data: null, error: { message: "boom" } }]);
    createServiceClient.mockReturnValue(db);
    expect((await revokeApiKey(ID)).ok).toBe(false);
  });

  it("service role assente: errore", async () => {
    createServiceClient.mockReturnValue(null);
    expect((await revokeApiKey(ID)).ok).toBe(false);
  });
});

// ============================================================ recheckApiKeyLink

const key = (over: Record<string, unknown> = {}) => ({
  id: ID,
  domain: "esempio.it",
  attribution_url: "https://esempio.it/prezzi",
  status: "active",
  link_failures: 0,
  ...over,
});

function patchOf(q: { ops: [string, unknown[]][] }) {
  return q.ops.find(([op]) => op === "update")?.[1][0] as Record<string, unknown>;
}

describe("recheckApiKeyLink", () => {
  it("non admin: lancia prima di toccare il DB o la rete", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(recheckApiKeyLink(ID)).rejects.toThrow("NEXT_REDIRECT");
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(fetchHasLink).not.toHaveBeenCalled();
  });

  it("id non valido: errore, nessuna query", async () => {
    expect((await recheckApiKeyLink("x")).ok).toBe(false);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("chiave inesistente: errore", async () => {
    const { db } = fakeSupabase([{ data: null, error: null }]);
    createServiceClient.mockReturnValue(db);
    expect((await recheckApiKeyLink(ID)).ok).toBe(false);
    expect(fetchHasLink).not.toHaveBeenCalled();
  });

  it.each(["pending", "revoked"])("chiave %s: niente verifica", async (status) => {
    const { db, queries } = fakeSupabase([{ data: key({ status }), error: null }]);
    createServiceClient.mockReturnValue(db);
    expect((await recheckApiKeyLink(ID)).ok).toBe(false);
    expect(fetchHasLink).not.toHaveBeenCalled();
    expect(queries).toHaveLength(1);
  });

  it("link trovato: chiave declassata torna attiva, update protetto dallo stato letto", async () => {
    const { db, queries } = fakeSupabase([
      { data: key({ status: "downgraded", link_failures: 2 }), error: null },
      { data: [{ id: ID }], error: null },
    ]);
    createServiceClient.mockReturnValue(db);
    fetchHasLink.mockResolvedValueOnce(true);

    const r = await recheckApiKeyLink(ID);
    expect(r.ok).toBe(true);
    expect(fetchHasLink).toHaveBeenCalledWith("https://esempio.it/prezzi", undefined, 5000);
    expect(queries).toHaveLength(2); // nessuna lettura di traffic_log
    const upd = queries[1];
    expect(upd.table).toBe("api_keys");
    expect(patchOf(upd)).toMatchObject({ status: "active", link_failures: 0, link_ok: true });
    expect(typeof patchOf(upd).link_checked_at).toBe("string");
    expect(upd.ops).toContainEqual(["eq", ["id", ID]]);
    expect(upd.ops).toContainEqual(["eq", ["status", "downgraded"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/it/admin");
  });

  it("link assente ma widget visto dal dominio: vale come link presente", async () => {
    const { db, queries } = fakeSupabase([
      { data: key({ link_failures: 1 }), error: null },
      {
        data: [
          { origin_host: "esempio.it", ip_hash: "h1" },
          { origin_host: "blog.esempio.it", ip_hash: "h2" },
        ],
        error: null,
      },
      { data: [{ id: ID }], error: null },
    ]);
    createServiceClient.mockReturnValue(db);
    fetchHasLink.mockResolvedValueOnce(false);

    expect((await recheckApiKeyLink(ID)).ok).toBe(true);
    expect(queries[1].table).toBe("traffic_log");
    expect(queries[1].ops).toContainEqual(["ilike", ["query", "%src=widget%"]]);
    expect(patchOf(queries[2])).toMatchObject({ status: "active", link_failures: 0, link_ok: true });
  });

  it("link assente due volte: declassata, nessuna email", async () => {
    const { db, queries } = fakeSupabase([
      { data: key({ link_failures: 1 }), error: null },
      { data: [], error: null },
      { data: [{ id: ID }], error: null },
    ]);
    createServiceClient.mockReturnValue(db);
    fetchHasLink.mockResolvedValueOnce(false);

    const r = await recheckApiKeyLink(ID);
    expect(r).toEqual({ ok: true, message: expect.stringMatching(/declassata/i) });
    expect(patchOf(queries[2])).toMatchObject({ status: "downgraded", link_failures: 2, link_ok: false });
  });

  it("lettura di traffic_log fallita: nessun update (non conta un fallimento a vuoto)", async () => {
    const { db, queries } = fakeSupabase([
      { data: key(), error: null },
      { data: null, error: { message: "relation traffic_log does not exist" } },
    ]);
    createServiceClient.mockReturnValue(db);
    fetchHasLink.mockResolvedValueOnce(false);

    expect((await recheckApiKeyLink(ID)).ok).toBe(false);
    expect(queries).toHaveLength(2);
  });

  it("chiave cambiata nel frattempo (update senza righe): errore", async () => {
    const { db } = fakeSupabase([
      { data: key(), error: null },
      { data: [], error: null },
    ]);
    createServiceClient.mockReturnValue(db);
    fetchHasLink.mockResolvedValueOnce(true);
    expect(await recheckApiKeyLink(ID)).toEqual({ ok: false, error: expect.stringMatching(/cambiata/i) });
  });
});
