/**
 * Plausible analytics helper — client-side only, SSR-safe.
 *
 * Setup: <Script defer data-domain="energyindex.it" src="https://plausible.io/js/script.js" />
 * caricato in app/layout.tsx. Lo script registra window.plausible() globale.
 */
declare global {
  interface Window {
    plausible?: (
      event: string,
      opts?: { props?: Record<string, string | number> },
    ) => void;
  }
}

export function trackEvent(
  name: string,
  props?: Record<string, string | number>,
): void {
  if (typeof window === "undefined") return;
  if (!window.plausible) return;
  window.plausible(name, props ? { props } : undefined);
}
