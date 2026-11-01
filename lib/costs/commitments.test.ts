import { describe, expect, it } from "vitest";
import {
  commitmentTotals,
  fromTripMinor,
  memberCommitment,
} from "./commitments";
import type { EngineOutput } from "./engine";

const output: EngineOutput = {
  perMember: [
    {
      memberId: "guardian",
      totalMinor: 10000,
      byCategory: { stay: 10000 },
      byLine: {},
      nights: 2,
      explain: [],
    },
    {
      memberId: "child",
      totalMinor: 5000,
      byCategory: { stay: 5000 },
      byLine: {},
      nights: 2,
      explain: [],
    },
    {
      memberId: "other",
      totalMinor: 20000,
      byCategory: {},
      byLine: {},
      nights: 3,
      explain: [],
    },
  ],
  totals: { estimateMinor: 35000, allocatedMinor: 35000, unallocatedMinor: 0 },
  warnings: [],
};

describe("commitments", () => {
  it("rolls dependents into the guardian and counts only confirmed, converted payments", () => {
    const result = memberCommitment(
      output,
      ["guardian", "child"],
      [
        {
          fromMemberId: "guardian",
          amountMinor: 11500,
          currency: "EUR",
          confirmedAt: "2026-11-01",
        },
        {
          fromMemberId: "child",
          amountMinor: 1000,
          currency: "GBP",
          confirmedAt: new Date(),
        },
        {
          fromMemberId: "guardian",
          amountMinor: 2000,
          currency: "GBP",
          confirmedAt: null,
        },
        {
          fromMemberId: "other",
          amountMinor: 9000,
          currency: "GBP",
          confirmedAt: "2026-11-01",
        },
      ],
      "GBP",
      { EUR: 1.15 },
    );
    expect(result.shareMinor).toBe(15000);
    expect(result.paidMinor).toBe(11000);
    expect(result.outstandingMinor).toBe(4000);
    expect(result.members.map((m) => m.memberId)).toEqual([
      "guardian",
      "child",
    ]);
    expect(memberCommitment(output, ["child"], [], "GBP", {}).shareMinor).toBe(
      5000,
    );
  });
  it("converts from a trip base to the family currency", () => {
    expect(fromTripMinor(10000, "GBP", "EUR", { EUR: 1.15 })).toBe(11500);
    expect(fromTripMinor(10000, "GBP", "GBP", {})).toBe(10000);
    expect(() => fromTripMinor(10000, "GBP", "EUR", {})).toThrow(
      "exchange rate",
    );
  });
  it("never adds different currencies directly and reconciles summary totals", () => {
    const totals = commitmentTotals(
      [
        { shareMinor: 10000, paidMinor: 2000, currency: "GBP", rates: {} },
        {
          shareMinor: 11500,
          paidMinor: 5750,
          currency: "EUR",
          rates: { GBP: 1 / 1.15 },
        },
      ],
      "GBP",
    );
    expect(totals).toEqual({
      shareMinor: 20000,
      paidMinor: 7000,
      outstandingMinor: 13000,
    });
    expect(commitmentTotals([], "GBP")).toEqual({
      shareMinor: 0,
      paidMinor: 0,
      outstandingMinor: 0,
    });
  });
});
