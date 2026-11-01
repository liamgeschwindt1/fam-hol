import { describe, expect, it } from "vitest";
import {
  add,
  allocate,
  convertMinor,
  currencyAmount,
  decimal,
  divide,
  formatMoney,
  multiply,
  parseMinor,
  round,
} from "./money";

describe("exact money arithmetic", () => {
  it("represents decimals and scientific notation exactly", () => {
    expect(decimal(0.1)).toEqual({ numerator: 1n, denominator: 10n });
    expect(decimal(1e-7)).toEqual({ numerator: 1n, denominator: 10000000n });
    expect(decimal(1e21)).toEqual({
      numerator: 1000000000000000000000n,
      denominator: 1n,
    });
    expect(decimal(-1.5)).toEqual({ numerator: -15n, denominator: 10n });
    expect(() => decimal(Infinity)).toThrow("finite");
  });
  it("adds, multiplies and divides rational numbers", () => {
    expect(round(add(decimal(0.1), decimal(0.2)))).toBe(0);
    expect(round(multiply(decimal(5), decimal(0.5)))).toBe(3);
    expect(round(divide(decimal(10), decimal(4)))).toBe(3);
    expect(() => divide(decimal(1), decimal(0))).toThrow("positive divisor");
    expect(round(decimal(-1.5))).toBe(-2);
    expect(() => round(decimal(1e21))).toThrow("safe integer");
  });
  it("requires a usable foreign currency rate rather than substituting money", () => {
    expect(convertMinor(11500, "EUR", "GBP", { EUR: 1.15 })).toBe(10000);
    expect(convertMinor(100, "GBP", "GBP", {})).toBe(100);
    for (const rate of [undefined, 0, -1, Infinity, NaN]) {
      expect(() => currencyAmount(1, "EUR", "GBP", { EUR: rate! })).toThrow(
        "exchange rate",
      );
    }
    expect(() => convertMinor(1.5, "GBP", "GBP", {})).toThrow(
      "integer minor units",
    );
  });
  it("allocates fractional pence only once with ID tie breaks", () => {
    const half = decimal(0.5);
    expect([
      ...allocate([
        { memberId: "b", amount: half },
        { memberId: "a", amount: half },
      ]),
    ]).toEqual([
      ["b", 0],
      ["a", 1],
    ]);
    expect([...allocate([{ memberId: "a", amount: decimal(1) }])]).toEqual([
      ["a", 1],
    ]);
    expect([...allocate([])]).toEqual([]);
    const result = allocate([
      { memberId: "a", amount: decimal(0.1) },
      { memberId: "c", amount: decimal(0.6) },
      { memberId: "b", amount: decimal(0.3) },
    ]);
    expect([...result.values()].reduce((a, b) => a + b, 0)).toBe(1);
    expect(result.get("c")).toBe(1);
  });
  it("parses form amounts without floating point arithmetic", () => {
    for (const [text, expected] of [
      ["0", 0],
      ["1.01", 101],
      ["-0.05", -5],
      ["1.1", 110],
      ["123456.78", 12345678],
    ] as const) {
      expect(parseMinor(text)).toBe(expected);
    }
    for (const text of ["", "1.001", "1e2", "NaN", "1,000", " 1"])
      expect(() => parseMinor(text)).toThrow("two decimal");
    expect(() => parseMinor("900719925474099200")).toThrow("safe integer");
    expect(formatMoney(123456, "GBP")).toBe("£1,234.56");
  });
});
