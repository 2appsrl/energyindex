/**
 * ENTSO-E EIC (Energy Identification Code) per zona di offerta (bidding zone).
 *
 * Riferimento ufficiale:
 *   https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html
 *   (Annex B - List of bidding zones in EICs)
 *
 * Per il day-ahead (`documentType=A44`) la query usa lo stesso EIC sia come
 * `in_Domain` sia come `out_Domain` (è il codice della "bidding zone").
 */
export const ENTSOE_DOMAINS = {
  // ---------------------------------------------------------------------
  // Italy bidding zones (post-2021 split: 6 zone fisiche)
  // ---------------------------------------------------------------------
  IT_NORTH: "10Y1001A1001A73I",
  IT_CNORTH: "10Y1001A1001A70O",
  IT_CSOUTH: "10Y1001A1001A71M",
  IT_SOUTH: "10Y1001A1001A788",
  IT_SICILY: "10Y1001A1001A75E",
  IT_SARDINIA: "10Y1001A1001A74G",
  IT_CALABRIA: "10Y1001C--00096J",

  // ---------------------------------------------------------------------
  // Major neighbors / core EU
  // ---------------------------------------------------------------------
  DE_LU: "10Y1001A1001A82H", // Germany-Luxembourg (post-2018 unified zone)
  AT: "10YAT-APG------L",
  FR: "10YFR-RTE------C",
  ES: "10YES-REE------0",
  PT: "10YPT-REN------W",
  CH: "10YCH-SWISSGRIDZ",
  NL: "10YNL----------L",
  BE: "10YBE----------2",

  // ---------------------------------------------------------------------
  // Northern Europe
  // ---------------------------------------------------------------------
  DK_1: "10YDK-1--------W",
  DK_2: "10YDK-2--------M",
  NO_1: "10YNO-1--------2",
  NO_2: "10YNO-2--------T",
  NO_3: "10YNO-3--------J",
  NO_4: "10YNO-4--------9",
  NO_5: "10Y1001A1001A48H",
  SE_1: "10Y1001A1001A44P",
  SE_2: "10Y1001A1001A45N",
  SE_3: "10Y1001A1001A46L",
  SE_4: "10Y1001A1001A47J",
  FI: "10YFI-1--------U",

  // ---------------------------------------------------------------------
  // Eastern / Central Europe
  // ---------------------------------------------------------------------
  PL: "10YPL-AREA-----S",
  CZ: "10YCZ-CEPS-----N",
  SK: "10YSK-SEPS-----K",
  HU: "10YHU-MAVIR----U",
  RO: "10YRO-TEL------P",
  BG: "10YCA-BULGARIA-R",
  GR: "10YGR-HTSO-----Y",
  SI: "10YSI-ELES-----O",
  HR: "10YHR-HEP------M",
  RS: "10YCS-SERBIATSOV",
} as const;

export type EntsoeDomain = keyof typeof ENTSOE_DOMAINS;
