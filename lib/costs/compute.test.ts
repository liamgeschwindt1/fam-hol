import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateCosts } from "./engine";
import { computeCosts } from "./compute";

const mocks = vi.hoisted(() => ({
  trip: { findUniqueOrThrow: vi.fn() },
  member: { findMany: vi.fn() },
  attendance: { findMany: vi.fn() },
  costCategory: { findMany: vi.fn() },
  room: { findMany: vi.fn() },
  costAdjustment: { findMany: vi.fn() },
  householdOwnStay: { findMany: vi.fn() },
  costSnapshot: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mocks }));
vi.mock("@paralleldrive/cuid2", () => ({ createId: () => "snapshot-id" }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.trip.findUniqueOrThrow.mockResolvedValue({
    id: "trip",
    familyId: "family",
    status: "PLANNING",
    startDate: new Date("2026-11-01"),
    endDate: new Date("2026-11-03"),
    currency: "GBP",
    fxRatesJson: { EUR: 1.15 },
    ageWeightsJson: { ADULT: 1, CHILD_12_17: 1, CHILD_5_11: 0.5, CHILD_0_4: 0 },
  });
  mocks.member.findMany.mockResolvedValue([
    { id: "adult", householdId: "house", ageBand: "ADULT", guardianId: null },
    {
      id: "child",
      householdId: "house",
      ageBand: "CHILD_5_11",
      guardianId: "adult",
    },
  ]);
  mocks.attendance.findMany.mockResolvedValue([
    { memberId: "adult", date: new Date("2026-11-01"), status: "IN" },
    { memberId: "child", date: new Date("2026-11-01"), status: "MAYBE" },
  ]);
  mocks.costCategory.findMany.mockResolvedValue([
    {
      id: "stay",
      isAccommodation: true,
      lines: [
        {
          id: "line",
          categoryId: "stay",
          label: "Hotel",
          amountMinor: 11500,
          currency: "EUR",
          basis: "SHARED_EQUAL",
          unit: "FLAT",
          applyAgeWeights: true,
          mealsPerDay: null,
        },
      ],
    },
  ]);
  mocks.room.findMany.mockResolvedValue([
    {
      id: "room",
      label: "Room",
      members: [{ memberId: "adult" }, { memberId: "child" }],
    },
  ]);
  mocks.costAdjustment.findMany.mockResolvedValue([
    {
      memberId: "adult",
      lineId: null,
      categoryId: null,
      deltaMinor: -100,
      overrideMinor: null,
      reason: null,
    },
  ]);
  mocks.householdOwnStay.findMany.mockResolvedValue([]);
  mocks.costSnapshot.findFirst.mockResolvedValue(null);
  mocks.costSnapshot.create.mockResolvedValue({});
});

describe("cost snapshots", () => {
  it("loads scoped inputs and persists a complete, explainable snapshot", async () => {
    const result = await computeCosts("trip");
    expect(result.totals).toEqual({
      estimateMinor: 10000,
      allocatedMinor: 9900,
      unallocatedMinor: 100,
    });
    expect(mocks.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId: "family" } }),
    );
    expect(mocks.costAdjustment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
    expect(mocks.costSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tripId: "trip",
        inputHash: expect.any(String),
        outputJson: result,
      }),
    });
  });
  it.each(["CONFIRMED", "HAPPENING", "DONE", "ARCHIVED"])(
    "excludes MAYBE for %s and invalidates the hash",
    async (status) => {
      await computeCosts("trip");
      const initialHash =
        mocks.costSnapshot.findFirst.mock.calls[0]![0].where.inputHash;
      const trip = await mocks.trip.findUniqueOrThrow();
      mocks.trip.findUniqueOrThrow.mockResolvedValue({ ...trip, status });
      const result = await computeCosts("trip");
      expect(
        result.perMember.find((m) => m.memberId === "child")?.totalMinor,
      ).toBe(0);
      expect(
        mocks.costSnapshot.findFirst.mock.calls[1]![0].where.inputHash,
      ).not.toBe(initialHash);
    },
  );
  it("handles defaults, full adjustment scopes, own stays and the IDEA estimate", async () => {
    const trip = await mocks.trip.findUniqueOrThrow();
    mocks.trip.findUniqueOrThrow.mockResolvedValue({
      ...trip,
      status: "IDEA",
      fxRatesJson: null,
    });
    mocks.costCategory.findMany.mockResolvedValue([
      { id: "stay", isAccommodation: true, lines: [] },
      {
        id: "food",
        isAccommodation: false,
        lines: [
          {
            id: "food-line",
            categoryId: "food",
            label: "Food",
            amountMinor: 100,
            currency: "GBP",
            basis: "PER_PERSON_PER_DAY_FOOD",
            unit: "DAY",
            applyAgeWeights: false,
            mealsPerDay: 2,
          },
        ],
      },
    ]);
    mocks.householdOwnStay.findMany.mockResolvedValue([
      { householdId: "house" },
    ]);
    mocks.costAdjustment.findMany.mockResolvedValue([
      {
        memberId: "adult",
        lineId: "food-line",
        categoryId: null,
        deltaMinor: null,
        overrideMinor: 150,
        reason: "Own meals",
      },
      {
        memberId: "child",
        lineId: null,
        categoryId: "food",
        deltaMinor: 10,
        overrideMinor: null,
        reason: null,
      },
    ]);
    const result = await computeCosts("trip");
    expect(result.perMember.map((m) => m.totalMinor)).toEqual([150, 210]);
  });
  it("uses a matching cached output without writing another snapshot", async () => {
    const result = calculateCosts({
      trip: {
        id: "trip",
        startDate: "2026-11-01",
        endDate: "2026-11-03",
        currency: "GBP",
        fxRates: {},
      },
      members: [],
      attendance: [],
      lines: [],
      ageWeights: { ADULT: 1, CHILD_12_17: 1, CHILD_5_11: 0.5, CHILD_0_4: 0 },
      includeMaybe: true,
      adjustments: [],
      excludedHouseholdIds: [],
    });
    mocks.costSnapshot.findFirst.mockResolvedValue({ outputJson: result });
    expect(await computeCosts("trip")).toEqual(result);
    expect(mocks.costSnapshot.create).not.toHaveBeenCalled();
  });
  it("surfaces malformed stored data and database failures", async () => {
    mocks.costSnapshot.findFirst.mockResolvedValue({
      outputJson: { totals: 0 },
    });
    await expect(computeCosts("trip")).rejects.toThrow();
    mocks.trip.findUniqueOrThrow.mockRejectedValue(
      new Error("Database unavailable"),
    );
    await expect(computeCosts("trip")).rejects.toThrow("Database unavailable");
  });
});
