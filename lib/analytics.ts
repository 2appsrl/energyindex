/**
 * Umami analytics helper — client-side only, SSR-safe.
 *
 * Setup: <Script defer src="https://cloud.umami.is/script.js"
 *                  data-website-id="..." /> caricato in app/layout.tsx.
 * Lo script registra window.umami globale con .track(name, data?).
 *
 * Umami trade-off vs Plausible: gratis (100k events/mese sul free tier
 * cloud) vs Plausible 9$/mese, stesso modello privacy-first (no cookies,
 * GDPR-compliant). API leggermente diversa: track(name, data) invece di
 * plausible(name, {props}).
 *
 * Backward-compat: la funzione trackEvent ha la stessa firma di prima,
 * cosi' i call site (LeadCaptureForm, ContactForm, ZoneSelector, ecc.)
 * funzionano senza modifiche.
 */
declare global {
  interface Window {
    umami?: {
      track: (
        eventName: string,
        eventData?: Record<string, string | number>,
      ) => void;
    };
  }
}

export function trackEvent(
  name: string,
  props?: Record<string, string | number>,
): void {
  if (typeof window === "undefined") return;
  if (!window.umami) return;
  window.umami.track(name, props);
}
