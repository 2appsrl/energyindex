import { NextResponse } from "next/server";
import {
  API_BASE_URL,
  API_CONTACT_EMAIL,
  API_DOCS_URL,
  CATEGORIES,
  ENDPOINTS,
  tierById,
  type ApiEndpoint,
  type EndpointParam,
} from "@/lib/api/catalog";

/**
 * GET /api/v1/openapi.json
 *
 * Spec OpenAPI 3.1 generata dal catalogo (lib/api/catalog.ts), quindi
 * sempre allineata a /it/api/docs. Importabile in Postman, Insomnia,
 * generatori di SDK e come tool negli agenti AI.
 *
 * Gli endpoint non ancora attivi sono marcati con `x-status: coming` e
 * `x-eidx-tier` indica il piano minimo.
 */

function schemaFor(p: EndpointParam) {
  const base: Record<string, unknown> = { type: p.type };
  // Nel catalogo gli enum sono stringhe anche per i parametri interi (horizon, window).
  if (p.enum) base.enum = p.type === "integer" ? p.enum.map(Number) : p.enum;
  if (p.default !== undefined) base.default = p.default;
  if (p.example !== undefined) base.example = p.example;
  return base;
}

function operation(e: ApiEndpoint, docsAnchor = e.id) {
  const tier = tierById(e.tier);
  const nonBody = e.params.filter((p) => p.in !== "body");
  const body = e.params.filter((p) => p.in === "body");
  const op: Record<string, unknown> = {
    operationId: e.id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
    summary: e.title,
    description: `${e.description}\n\nPiano minimo: ${tier.name}.${e.status === "coming" ? " In arrivo: contratto in anteprima, l'endpoint non risponde ancora." : ""}`,
    tags: [CATEGORIES.find((c) => c.id === e.category)!.name],
    "x-status": e.status,
    "x-eidx-tier": e.tier,
    externalDocs: { url: `${API_DOCS_URL}#${docsAnchor}` },
    parameters: nonBody.map((p) => ({
      name: p.name,
      in: p.in,
      required: p.in === "path" ? true : p.required,
      description: p.description,
      schema: schemaFor(p),
    })),
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": { example: e.response },
          ...(e.formats.includes("csv") ? { "text/csv": { schema: { type: "string" } } } : {}),
        },
      },
      "400": { $ref: "#/components/responses/Error" },
      ...(e.tier !== "open" ? { "401": { $ref: "#/components/responses/Error" }, "403": { $ref: "#/components/responses/Error" } } : {}),
      "429": { $ref: "#/components/responses/Error" },
      "503": { $ref: "#/components/responses/Error" },
    },
  };
  if (e.tier === "open") op.security = [];
  if (body.length > 0) {
    op.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: body.filter((p) => p.required).map((p) => p.name),
            properties: Object.fromEntries(body.map((p) => [p.name, { ...schemaFor(p), description: p.description }])),
          },
          example: e.exampleBody,
        },
      },
    };
  }
  return op;
}

function buildSpec() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    // "/{asset}/today" in OpenAPI sarebbe ambiguo con ogni path a due
    // segmenti (/forecast/{asset}, /bulk/{dataset}): si espande in un path
    // concreto per valore dell'enum.
    const lead = e.path.match(/^\/\{(\w+)\}/)?.[1];
    const leadParam = lead ? e.params.find((p) => p.name === lead) : undefined;
    const variants = leadParam?.enum
      ? leadParam.enum.map((v) => ({
          path: e.path.replace(`{${lead}}`, v),
          e: { ...e, id: `${e.id}-${v}`, params: e.params.filter((p) => p !== leadParam) },
        }))
      : [{ path: e.path, e }];
    for (const v of variants) {
      paths[v.path] ??= {};
      paths[v.path][e.method.toLowerCase()] = operation(v.e, e.id);
    }
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Energy Index API",
      version: "1.0.0",
      description:
        "Prezzi all'ingrosso dell'energia in Italia (PUN, PSV, prezzi zonali), indici di contesto (TTF, Brent, CO2), Energy Index delle offerte ARERA e forecast EIDX Research. Endpoint Open gratuiti senza chiave, con attribuzione obbligatoria.",
      contact: { name: "Energy Index", email: API_CONTACT_EMAIL, url: "https://energyindex.it/it/api" },
      license: { name: "Gratuita con attribuzione (piani Open e Developer)", url: `${API_DOCS_URL}#licenza` },
    },
    externalDocs: { description: "Documentazione completa", url: API_DOCS_URL },
    servers: [{ url: API_BASE_URL }],
    tags: CATEGORIES.map((c) => ({ name: c.name, description: c.description })),
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "API key eidx_live_… nell'header Authorization." },
      },
      responses: {
        Error: {
          description: "Errore",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["error", "message"],
                properties: {
                  error: { type: "string", example: "rate_limited" },
                  message: { type: "string" },
                  required_tier: { type: "string" },
                  param: { type: "string" },
                  docs: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
  "Access-Control-Allow-Origin": "*",
} as const;

export function GET() {
  return NextResponse.json(buildSpec(), { status: 200, headers });
}
