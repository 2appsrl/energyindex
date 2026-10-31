/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { linkCheckEmail, runLinkChecks, type CheckableKey, type LinkCheckDeps } from "@/lib/api-keys/link-check-job";

const NOW = new Date("2026-11-02T07:00:00Z");

function key(over: Partial<CheckableKey> = {}): CheckableKey {
  return {
    id: "k1",
    email: "g@esempio.it",
    nome: "Giovanni",
    domain: "esempio.it",
    attribution_url: "https://esempio.it/prezzi",
    status: "active",
    link_failures: 0,
    ...over,
  };
}

function deps(over: Partial<LinkCheckDeps> = {}): LinkCheckDeps {
  return {
    hasLink: vi.fn(async () => true),
    widgetSeen: vi.fn(async () => false),
    update: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
    now: () => NOW,
    log: () => {},
    ...over,
  };
}

describe("runLinkChecks", () => {
  it("link presente: azzera i fallimenti e riattiva una chiave declassata", async () => {
    const d = deps();
    const k = key({ status: "downgraded", link_failures: 3 });
    const s = await runLinkChecks([k], d);
    expect(d.update).toHaveBeenCalledWith(k, {
      status: "active",
      link_failures: 0,
      link_ok: true,
      link_checked_at: NOW.toISOString(),
    });
    expect(d.notify).toHaveBeenCalledWith(k, "restored");
    expect(s).toMatchObject({ checked: 1, ok: 1, failed: 0, downgraded: 0, restored: 1, errors: 0 });
  });

  it("primo fallimento: solo conteggio, nessuna email", async () => {
    const d = deps({ hasLink: vi.fn(async () => false) });
    const s = await runLinkChecks([key()], d);
    expect(d.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "active", link_failures: 1, link_ok: false }));
    expect(d.notify).not.toHaveBeenCalled();
    expect(s).toMatchObject({ ok: 0, failed: 1, downgraded: 0 });
  });

  it("secondo fallimento consecutivo: declassa e avvisa", async () => {
    const d = deps({ hasLink: vi.fn(async () => false) });
    const k = key({ link_failures: 1 });
    const s = await runLinkChecks([k], d);
    expect(d.update).toHaveBeenCalledWith(k, expect.objectContaining({ status: "downgraded", link_failures: 2, link_ok: false }));
    expect(d.notify).toHaveBeenCalledWith(k, "downgraded");
    expect(s).toMatchObject({ failed: 1, downgraded: 1, restored: 0 });
  });

  it("widget visto dal dominio: vale come link presente anche se la pagina non risponde", async () => {
    const d = deps({ hasLink: vi.fn(async () => false), widgetSeen: vi.fn(async () => true) });
    const k = key({ link_failures: 1 });
    const s = await runLinkChecks([k], d);
    expect(d.widgetSeen).toHaveBeenCalledWith("esempio.it");
    expect(d.update).toHaveBeenCalledWith(k, expect.objectContaining({ status: "active", link_failures: 0, link_ok: true }));
    expect(d.notify).not.toHaveBeenCalled();
    expect(s).toMatchObject({ ok: 1, failed: 0 });
  });

  it("non interroga traffic_log se il link c'e'", async () => {
    const d = deps();
    await runLinkChecks([key()], d);
    expect(d.widgetSeen).not.toHaveBeenCalled();
  });

  it("l'errore su una chiave non ferma le altre e finisce nel riepilogo", async () => {
    const a = key({ id: "a", attribution_url: "https://a.it/x" });
    const b = key({ id: "b", attribution_url: "https://b.it/x" });
    const c = key({ id: "c", attribution_url: "https://c.it/x" });
    const d = deps({
      hasLink: vi.fn(async (url: string) => {
        if (url === "https://a.it/x") throw new Error("boom");
        return true;
      }),
      update: vi.fn(async (k: CheckableKey) => {
        if (k.id === "b") throw new Error("db giu'");
      }),
    });
    const s = await runLinkChecks([a, b, c], d);
    expect(d.update).toHaveBeenCalledTimes(2); // b (fallito) e c
    expect(d.update).toHaveBeenCalledWith(c, expect.objectContaining({ status: "active" }));
    expect(s).toMatchObject({ checked: 3, ok: 1, errors: 2 });
  });

  it("nessuna email se l'aggiornamento non e' andato a buon fine", async () => {
    const d = deps({ update: vi.fn(async () => { throw new Error("db"); }) });
    await runLinkChecks([key({ status: "downgraded" })], d);
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("un'email fallita non conta come errore della chiave", async () => {
    const d = deps({ notify: vi.fn(async () => { throw new Error("resend"); }) });
    const s = await runLinkChecks([key({ status: "downgraded" })], d);
    expect(s).toMatchObject({ restored: 1, errors: 0, notifyErrors: 1 });
  });
});

describe("linkCheckEmail", () => {
  it("toglie a capo dal nome", () => {
    const m = linkCheckEmail(key({ nome: "Gio\r\nBcc: x@y.it" }), "downgraded");
    expect(m.text.split("\n")[0]).toBe("Ciao Gio Bcc: x@y.it,");
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
  it("testi diversi per declassamento e riattivazione", () => {
    expect(linkCheckEmail(key(), "downgraded").text).toContain("https://esempio.it/prezzi");
    expect(linkCheckEmail(key(), "downgraded").subject).not.toBe(linkCheckEmail(key(), "restored").subject);
  });
});
