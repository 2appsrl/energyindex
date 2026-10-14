/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "@/lib/analytics";

describe("trackEvent (Umami)", () => {
  beforeEach(() => {
    delete (window as { umami?: unknown }).umami;
  });

  it("does nothing if umami is not loaded", () => {
    expect(() => trackEvent("foo")).not.toThrow();
  });

  it("calls window.umami.track with event name only when no props", () => {
    const track = vi.fn();
    (window as { umami?: unknown }).umami = { track };
    trackEvent("test_event");
    expect(track).toHaveBeenCalledWith("test_event", undefined);
  });

  it("passes props as event data", () => {
    const track = vi.fn();
    (window as { umami?: unknown }).umami = { track };
    trackEvent("zone_change", { zone: "nord" });
    expect(track).toHaveBeenCalledWith("zone_change", { zone: "nord" });
  });

  it("is safe on SSR (no window)", () => {
    const originalWindow = global.window;
    // @ts-expect-error simulate SSR
    delete global.window;
    expect(() => trackEvent("ssr_safe")).not.toThrow();
    global.window = originalWindow;
  });
});
