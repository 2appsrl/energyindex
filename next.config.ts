import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

// NB: i redirect NON vanno messi qui. Su Netlify il middleware Next gira come
// edge function prima del routing interno, quindi `redirects()` di next.config
// non viene mai raggiunto (provato: deploy `ready`, ma /pun rispondeva ancora
// col 307 di next-intl). Stanno tutti in middleware.ts.
const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
