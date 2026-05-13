/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { BaseIngestor, type Observation } from "@/scripts/lib/base-ingestor";

class TestIngestor extends BaseIngestor {
  name = "test";
  assetSlug = "test-asset";
  async fetch() { return [{ date: "2026-05-13", value: 100 }]; }
  parse(raw: { date: string; value: number }[]): Observation[] {
    return raw.map((r) => ({
      observed_at: new Date(r.date + "T12:00:00Z"),
      value: r.value,
    }));
  }
}

describe("BaseIngestor", () => {
  it("run() invoca fetch+parse+upsert e ritorna conteggio righe", async () => {
    const ing = new TestIngestor();
    const upsertSpy = vi.spyOn(ing as unknown as { upsert: (...a: unknown[]) => Promise<number> }, "upsert")
      .mockResolvedValue(1);
    const res = await ing.run();
    expect(res.status).toBe("success");
    expect(res.rows).toBe(1);
    expect(upsertSpy).toHaveBeenCalledOnce();
  });

  it("run() cattura errori e li riporta nel result senza throw", async () => {
    class FailingIngestor extends BaseIngestor {
      name = "fail"; assetSlug = "test-asset";
      async fetch(): Promise<never> { throw new Error("boom"); }
      parse(): Observation[] { return []; }
    }
    const res = await new FailingIngestor().run();
    expect(res.status).toBe("error");
    expect(res.error).toContain("boom");
  });
});
