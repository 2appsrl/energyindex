/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "@/lib/analytics";

describe("trackEvent", () => {
  beforeEach(() => {
    delete (window as { plausible?: unknown }).plausible;
  });

  it("does nothing if plausible is not loaded", () => {
    expect(() => trackEvent("foo")).not.toThrow();
  });

  it("calls window.plausible with event name only when no props", () => {
    const spy = vi.fn();
    (window as { plausible?: unknown }).plausible = spy;
    trackEvent("test_event");
    expect(spy).toHaveBeenCalledWith("test_event", undefined);
  });

  it("wraps props under { props } when passed", () => {
    const spy = vi.fn();
    (window as { plausible?: unknown }).plausible = spy;
    trackEvent("zone_change", { zone: "nord" });
    expect(spy).toHaveBeenCalledWith("zone_change", { props: { zone: "nord" } });
  });

  it("is safe on SSR (no window)", () => {
    const originalWindow = global.window;
    // @ts-expect-error simulate SSR
    delete global.window;
    expect(() => trackEvent("ssr_safe")).not.toThrow();
    global.window = originalWindow;
  });
});
