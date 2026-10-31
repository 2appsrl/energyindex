import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/openapi.json/route";

type Spec = {
  paths: Record<string, Record<string, { security?: unknown; responses: Record<string, { $ref: string }> }>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: { Error: { properties: Record<string, unknown> } };
    responses: { RateLimited: { headers: Record<string, unknown> } };
  };
};

describe("openapi.json", () => {
  it("/pun/today: chiave facoltativa, 401/403 e 429 con Retry-After", async () => {
    const spec = (await GET().json()) as Spec;
    const op = spec.paths["/pun/today"].get;
    expect(op.security).toEqual([{}, { bearerAuth: [] }]);
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect(op.responses["401"].$ref).toBe("#/components/responses/Error");
    expect(op.responses["403"].$ref).toBe("#/components/responses/Error");
    expect(op.responses["429"].$ref).toBe("#/components/responses/RateLimited");
    expect(spec.components.responses.RateLimited.headers["Retry-After"]).toBeDefined();
    expect(Object.keys(spec.components.schemas.Error.properties)).toEqual(
      expect.arrayContaining(["error", "message", "param", "attribution", "required_tier"]),
    );
    expect(spec.components.schemas.Error.properties).not.toHaveProperty("docs");
  });
});
