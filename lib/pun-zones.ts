export type ZoneCode =
  | "nazionale"
  | "nord"
  | "cnor"
  | "csud"
  | "sud"
  | "sici"
  | "sard";

export interface PunZone {
  code: ZoneCode;
  /** Slug dell'asset corrispondente in DB. */
  slug: string;
  /** Nome lungo per heading/breadcrumb. */
  displayName: string;
  /** Etichetta corta per pill / label mappa. */
  displayShort: string;
  /** true solo per nazionale (asset slug 'pun'). */
  isNational: boolean;
}

export const PUN_ZONES: readonly PunZone[] = [
  { code: "nazionale", slug: "pun",            displayName: "PUN Nazionale",        displayShort: "Nazionale", isNational: true  },
  { code: "nord",      slug: "pun-zona-nord",  displayName: "PUN Zona Nord",        displayShort: "Nord",      isNational: false },
  { code: "cnor",      slug: "pun-zona-cnor",  displayName: "PUN Zona Centro-Nord", displayShort: "C-Nord",    isNational: false },
  { code: "csud",      slug: "pun-zona-csud",  displayName: "PUN Zona Centro-Sud",  displayShort: "C-Sud",     isNational: false },
  { code: "sud",       slug: "pun-zona-sud",   displayName: "PUN Zona Sud",         displayShort: "Sud",       isNational: false },
  { code: "sici",      slug: "pun-zona-sici",  displayName: "PUN Zona Sicilia",     displayShort: "Sicilia",   isNational: false },
  { code: "sard",      slug: "pun-zona-sard",  displayName: "PUN Zona Sardegna",    displayShort: "Sardegna",  isNational: false },
] as const;

const BY_CODE = new Map<string, PunZone>(PUN_ZONES.map((z) => [z.code, z]));

export function resolveZone(input: string | undefined): PunZone {
  return (input ? BY_CODE.get(input) : undefined) ?? PUN_ZONES[0];
}
