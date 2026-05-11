import { describe, it, expect } from "vitest";
import { resolveTimeframe, TIMEFRAMES, type Timeframe } from "@/lib/timeframes";

describe("resolveTimeframe", () => {
  it("returns 5Y default when input is undefined or invalid", () => {
    expect(resolveTimeframe(undefined).id).toBe("5Y");
    expect(resolveTimeframe("nope").id).toBe("5Y");
    expect(resolveTimeframe("").id).toBe("5Y");
  });

  it("accepts all 7 valid presets", () => {
    const ids: Timeframe["id"][] = ["5Y", "1Y", "6M", "3M", "1M", "1S", "1G"];
    for (const id of ids) {
      expect(resolveTimeframe(id).id).toBe(id);
    }
  });

  it("maps 5Y to monthly bucket, interval '5 years'", () => {
    const tf = resolveTimeframe("5Y");
    expect(tf.bucket).toBe("month");
    expect(tf.intervalSql).toBe("5 years");
  });

  it("maps 1Y/6M/3M/1M to daily bucket", () => {
    for (const id of ["1Y", "6M", "3M", "1M"] as const) {
      expect(resolveTimeframe(id).bucket).toBe("day");
    }
  });

  it("maps 1S/1G to raw (no bucket aggregation)", () => {
    expect(resolveTimeframe("1S").bucket).toBe("raw");
    expect(resolveTimeframe("1G").bucket).toBe("raw");
  });

  it("exposes TIMEFRAMES array in display order 5Y...1G", () => {
    expect(TIMEFRAMES.map((t) => t.id)).toEqual([
      "5Y", "1Y", "6M", "3M", "1M", "1S", "1G",
    ]);
  });

  it("hourly source: 5Y month, 1Y/6M/3M/1M day, 1S/1G raw", () => {
    expect(resolveTimeframe("5Y", "hourly").bucket).toBe("month");
    expect(resolveTimeframe("1Y", "hourly").bucket).toBe("day");
    expect(resolveTimeframe("6M", "hourly").bucket).toBe("day");
    expect(resolveTimeframe("3M", "hourly").bucket).toBe("day");
    expect(resolveTimeframe("1M", "hourly").bucket).toBe("day");
    expect(resolveTimeframe("1S", "hourly").bucket).toBe("raw");
    expect(resolveTimeframe("1G", "hourly").bucket).toBe("raw");
  });

  it("daily source: 5Y month, 1Y week, 6M/3M/1M/1S/1G raw", () => {
    expect(resolveTimeframe("5Y", "daily").bucket).toBe("month");
    expect(resolveTimeframe("1Y", "daily").bucket).toBe("week");
    expect(resolveTimeframe("6M", "daily").bucket).toBe("raw");
    expect(resolveTimeframe("3M", "daily").bucket).toBe("raw");
    expect(resolveTimeframe("1M", "daily").bucket).toBe("raw");
    expect(resolveTimeframe("1S", "daily").bucket).toBe("raw");
    expect(resolveTimeframe("1G", "daily").bucket).toBe("raw");
  });

  it("defaults to hourly when source param omitted (backward compat)", () => {
    expect(resolveTimeframe("5Y").bucket).toBe("month");
    expect(resolveTimeframe("1S").bucket).toBe("raw");
  });
});
