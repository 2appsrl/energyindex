/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { validateDeveloperRequest } from "@/lib/api-keys/issue";

const ok = { nome: "Giovanni", email: "g@esempio.it", dominio: "www.esempio.it", attributionUrl: "https://esempio.it/prezzi", progetto: "Widget PUN sul blog" };

describe("validateDeveloperRequest", () => {
  it("normalizza il dominio", () => {
    expect(validateDeveloperRequest(ok)).toEqual({ ok: true, domain: "esempio.it" });
  });
  it("accetta la pagina su un sottodominio del dominio dichiarato", () => {
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "https://blog.esempio.it/x" }).ok).toBe(true);
  });
  it("la pagina di attribuzione deve stare sul dominio dichiarato", () => {
    const r = validateDeveloperRequest({ ...ok, attributionUrl: "https://altro.it/x" });
    expect(r.ok).toBe(false);
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "https://esempio.it.altro.it/x" }).ok).toBe(false);
  });
  it("rifiuta dominio non valido e URL non https", () => {
    expect(validateDeveloperRequest({ ...ok, dominio: "localhost" }).ok).toBe(false);
    expect(validateDeveloperRequest({ ...ok, dominio: "github.io" }).ok).toBe(false);
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "ftp://esempio.it" }).ok).toBe(false);
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "non un url" }).ok).toBe(false);
  });
  it("rifiuta pagine su loopback anche se il dominio e' valido", () => {
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "http://127.0.0.1/x" }).ok).toBe(false);
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "http://localhost:3000/x" }).ok).toBe(false);
  });
  it("rifiuta porte non standard e campi mancanti o troppo lunghi", () => {
    expect(validateDeveloperRequest({ ...ok, attributionUrl: "https://esempio.it:8080/x" }).ok).toBe(false);
    expect(validateDeveloperRequest({ ...ok, dominio: undefined as unknown as string }).ok).toBe(false);
    expect(validateDeveloperRequest({ ...ok, attributionUrl: `https://esempio.it/${"a".repeat(2100)}` }).ok).toBe(false);
  });
});
