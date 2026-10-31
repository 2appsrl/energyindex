/**
 * Genera public/widget.js (IIFE minificata) da lib/widget/browser.ts.
 * Lanciato dal prebuild. WIDGET_BASE sostituisce l'origine dell'API solo per
 * le prove locali (es. WIDGET_BASE=http://localhost:3108); con
 * CONTEXT=production (Netlify) si usa sempre https://energyindex.it.
 */
import { build } from "esbuild";

const PROD_BASE = "https://energyindex.it";
// Su Netlify in produzione (CONTEXT=production) WIDGET_BASE non conta mai.
const base = process.env.CONTEXT === "production" ? PROD_BASE : (process.env.WIDGET_BASE ?? PROD_BASE);
if (base !== PROD_BASE) {
  console.warn(`!!! ATTENZIONE: widget.js punta a ${base}, NON a ${PROD_BASE}: solo per prove locali, non pubblicarlo !!!`);
}
const outfile = process.env.WIDGET_OUT ?? "public/widget.js";

build({
  entryPoints: ["lib/widget/browser.ts"],
  outfile,
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  legalComments: "none",
  define: { __EIDX_BASE__: JSON.stringify(base) },
  banner: { js: "/* Energy Index widget — https://energyindex.it/it/api/widget */" },
}).then(
  () => console.log(`${outfile} generato (API: ${base})`),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
