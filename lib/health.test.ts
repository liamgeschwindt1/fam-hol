import { describe, it, expect } from "vitest";

describe("health", () => {
  it("returns ok with a timestamp", () => {
    const before = Date.now();
    const result = { ok: true, ts: Date.now() };
    const after = Date.now();

    expect(result.ok).toBe(true);
    expect(result.ts).toBeGreaterThanOrEqual(before);
    expect(result.ts).toBeLessThanOrEqual(after);
  });
});
