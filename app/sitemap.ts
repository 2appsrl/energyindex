import type { MetadataRoute } from "next";

const BASE = "https://energyindex.it";
const ZONES = ["nord", "cnor", "csud", "sud", "sici", "sard"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/it`, lastModified: now, priority: 1.0, changeFrequency: "hourly" },
    { url: `${BASE}/it/indice/pun`, lastModified: now, priority: 0.9, changeFrequency: "hourly" },
    ...ZONES.map((z) => ({
      url: `${BASE}/it/indice/pun?zone=${z}`,
      lastModified: now,
      priority: 0.7 as const,
      changeFrequency: "hourly" as const,
    })),
    { url: `${BASE}/it/indice/psv`, lastModified: now, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/it/indice/brent`, lastModified: now, priority: 0.7, changeFrequency: "daily" },
    { url: `${BASE}/it/indice/co2`, lastModified: now, priority: 0.7, changeFrequency: "daily" },
    { url: `${BASE}/it/indice/temperatura`, lastModified: now, priority: 0.6, changeFrequency: "daily" },
    { url: `${BASE}/it/mercato-libero`, lastModified: now, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/it/mercato-libero/ticker`, lastModified: now, priority: 0.7, changeFrequency: "daily" },
  ];
}
