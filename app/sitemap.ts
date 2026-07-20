import type { MetadataRoute } from "next";

const BASE = "https://energyindex.it";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE}/it`,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE}/it/indice/pun`,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE}/it/indice/psv`,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE}/it/mercato-libero`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE}/it/mercato-libero/ticker`,
      changeFrequency: "daily",
      priority: 0.6,
    },
  ];
}
