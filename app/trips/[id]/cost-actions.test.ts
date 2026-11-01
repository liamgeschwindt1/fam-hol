import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCostCategory,
  addCostLine,
  addRoom,
  adjustCost,
  removeCostCategory,
  removeCostLine,
  removeRoom,
  setAgeWeights,
  setBankDetails,
  setFxRate,
  spreadShortfall,
  updateCostCategory,
  updateCostLine,
} from "./cost-actions";

const mocks = vi.hoisted(() => {
  const tx = {
    trip: { findFirstOrThrow: vi.fn(), update: vi.fn() },
    member: { findMany: vi.fn(), findFirstOrThrow: vi.fn(), count: vi.fn() },
    costCategory: {
      findUniqueOrThrow: vi.fn(),
      findFirstOrThrow: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    costLine: {
      findUniqueOrThrow: vi.fn(),
      findFirstOrThrow: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    costAdjustment: { create: vi.fn(), createMany: vi.fn() },
    room: { findFirstOrThrow: vi.fn(), create: vi.fn(), delete: vi.fn() },
    roomMember: { count: vi.fn() },
    activityLog: { create: vi.fn() },
    tripRevision: { create: vi.fn() },
    notification: { createMany: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    requireMember: vi.fn(),
    computeCosts: vi.fn(),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({
  db: { ...mocks.tx, $transaction: mocks.transaction },
}));
vi.mock("@/lib/auth", () => ({ requireMember: mocks.requireMember }));
vi.mock("@/lib/costs/compute", () => ({ computeCosts: mocks.computeCosts }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@paralleldrive/cuid2", () => ({ createId: () => "generated-id" }));

const line = {
  label: "Villa",
  amountMinor: 240000,
  currency: "GBP" as const,
  basis: "SHARED_BY_PERSON_NIGHTS" as const,
  unit: "NIGHT" as const,
  applyAgeWeights: true,
};
const weights = { ADULT: 1, CHILD_12_17: 1, CHILD_5_11: 0.5, CHILD_0_4: 0 };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (action) => action(mocks.tx));
  mocks.requireMember.mockResolvedValue({
    member: { id: "captain" },
    family: { id: "family" },
  });
  mocks.tx.trip.findFirstOrThrow.mockResolvedValue({
    id: "trip",
    familyId: "family",
    captainId: "captain",
    title: "Trip",
    fxRatesJson: { EUR: 1.15 },
  });
  mocks.tx.trip.update.mockResolvedValue({
    revision: 2,
    title: "Trip",
    tagline: null,
    descriptionMd: "",
    season: "OTHER",
    status: "PLANNING",
    currency: "GBP",
    startDate: new Date("2026-11-01"),
    endDate: new Date("2026-11-03"),
    fxRatesJson: { EUR: 1.15 },
    ageWeightsJson: weights,
  });
  mocks.tx.member.findMany.mockResolvedValue([
    { id: "attendee", guardianId: null },
    { id: "child", guardianId: "guardian" },
  ]);
  mocks.tx.member.findFirstOrThrow.mockResolvedValue({
    id: "child",
    familyId: "family",
    guardianId: "guardian",
    isDependent: true,
  });
  mocks.tx.member.count.mockResolvedValue(2);
  mocks.tx.costCategory.aggregate.mockResolvedValue({ _max: { sort: null } });
  mocks.tx.costLine.aggregate.mockResolvedValue({ _max: { sort: 2 } });
  mocks.tx.costCategory.findUniqueOrThrow.mockResolvedValue({
    id: "category",
    tripId: "trip",
  });
  mocks.tx.costLine.findUniqueOrThrow.mockResolvedValue({
    id: "line",
    tripId: "trip",
  });
  mocks.tx.costCategory.findFirstOrThrow.mockResolvedValue({
    id: "category",
    tripId: "trip",
  });
  mocks.tx.costLine.findFirstOrThrow.mockResolvedValue({
    id: "line",
    tripId: "trip",
  });
  mocks.tx.room.findFirstOrThrow.mockResolvedValue({
    id: "room",
    tripId: "trip",
  });
  mocks.tx.roomMember.count.mockResolvedValue(0);
  mocks.computeCosts.mockResolvedValue({
    perMember: [
      { memberId: "a", nights: 1, explain: [] },
      { memberId: "b", nights: 1, explain: [] },
      { memberId: "absent", nights: 0, explain: [] },
    ],
    totals: { unallocatedMinor: 101 },
  });
});

describe("cost server boundaries", () => {
  it("checks captain permission even when the client sends a valid line", async () => {
    mocks.requireMember.mockResolvedValue({
      member: { id: "not-captain" },
      family: { id: "family" },
    });
    await expect(addCostLine("trip", "category", line)).rejects.toThrow(
      "captain",
    );
    expect(mocks.tx.costLine.create).not.toHaveBeenCalled();
    expect(mocks.tx.trip.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: "trip", familyId: "family" },
    });
  });
  it("enforces category/trip ownership and validates money before writing", async () => {
    mocks.tx.costCategory.findFirstOrThrow.mockRejectedValue(
      new Error("Not found"),
    );
    await expect(addCostLine("trip", "foreign-category", line)).rejects.toThrow(
      "Not found",
    );
    expect(mocks.tx.costLine.create).not.toHaveBeenCalled();
    await expect(
      addCostLine("trip", "category", { ...line, amountMinor: 1.5 }),
    ).rejects.toThrow();
    await expect(
      addCostLine("trip", "category", { ...line, amountMinor: 2147483648 }),
    ).rejects.toThrow();
  });
  it("permits guardian adjustments but rejects other members and mixed scopes", async () => {
    mocks.requireMember.mockResolvedValue({
      member: { id: "guardian" },
      family: { id: "family" },
    });
    await adjustCost("trip", "child", {
      overrideMinor: 5000,
      lineId: "line",
      reason: "Child share",
    });
    expect(mocks.tx.costLine.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: "line", tripId: "trip" },
    });
    expect(mocks.tx.costAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        memberId: "child",
        createdById: "guardian",
        overrideMinor: 5000,
      }),
    });
    mocks.requireMember.mockResolvedValue({
      member: { id: "other" },
      family: { id: "family" },
    });
    await expect(
      adjustCost("trip", "child", { deltaMinor: -500 }),
    ).rejects.toThrow("dependents");
    await expect(adjustCost("trip", "child", {})).rejects.toThrow();
    await expect(
      adjustCost("trip", "child", { deltaMinor: 1, overrideMinor: 2 }),
    ).rejects.toThrow();
    await expect(
      adjustCost("trip", "child", {
        lineId: "line",
        categoryId: "category",
        deltaMinor: 1,
      }),
    ).rejects.toThrow();
  });
  it("allows self and captain adjustments and validates category scope", async () => {
    mocks.requireMember.mockResolvedValue({
      member: { id: "child" },
      family: { id: "family" },
    });
    await adjustCost("trip", "child", {
      categoryId: "category",
      deltaMinor: -100,
    });
    expect(mocks.tx.costCategory.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: "category", tripId: "trip" },
    });
    mocks.requireMember.mockResolvedValue({
      member: { id: "captain" },
      family: { id: "family" },
    });
    await adjustCost("trip", "child", { overrideMinor: 0 });
  });
  it("spreads exactly the shortfall across attendees in one audited transaction", async () => {
    await spreadShortfall("trip");
    expect(mocks.tx.costAdjustment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ memberId: "a", deltaMinor: 51 }),
        expect.objectContaining({ memberId: "b", deltaMinor: 50 }),
      ],
    });
    expect(mocks.computeCosts).toHaveBeenCalledWith("trip", mocks.tx);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(mocks.tx.activityLog.create).toHaveBeenCalled();
    expect(mocks.tx.tripRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ revision: 2, actorId: "captain" }),
    });
    expect(mocks.tx.trip.update).toHaveBeenCalledWith({
      where: { id: "trip" },
      data: { revision: { increment: 1 } },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/me");
    expect(mocks.tx.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ memberId: "guardian", type: "COST_CHANGED" }),
      ]),
    });
  });
  it("reports when a shortfall cannot be spread", async () => {
    mocks.computeCosts.mockResolvedValue({
      perMember: [],
      totals: { unallocatedMinor: 0 },
    });
    await expect(spreadShortfall("trip")).rejects.toThrow("no shortfall");
    mocks.computeCosts.mockResolvedValue({
      perMember: [],
      totals: { unallocatedMinor: 1 },
    });
    await expect(spreadShortfall("trip")).rejects.toThrow("No attendees");
  });
  it("merges frozen exchange rates instead of deleting the previous currency", async () => {
    await setFxRate("trip", { GBP: 1 }, "2026-11-01T00:00:00.000Z");
    expect(mocks.tx.trip.update).toHaveBeenCalledWith({
      where: { id: "trip" },
      data: {
        fxRatesJson: { EUR: 1.15, GBP: 1 },
        fxAsOf: new Date("2026-11-01"),
      },
    });
    await expect(setFxRate("trip", { EUR: 0 }, "invalid")).rejects.toThrow();
  });
  it("supports category, line, room and weight controls", async () => {
    await addCostCategory("trip", "Accommodation", true);
    await updateCostCategory("category", "Hotel", true);
    await removeCostCategory("category");
    await updateCostLine("line", line);
    await removeCostLine("line");
    await addRoom("trip", "Family room", ["guardian", "child"]);
    await removeRoom("room");
    await setAgeWeights("trip", weights);
    await setBankDetails("trip", "Payment instructions");
    expect(mocks.tx.costCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isAccommodation: true }),
    });
    expect(mocks.tx.room.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        members: { create: [{ memberId: "guardian" }, { memberId: "child" }] },
      }),
    });
  });
  it("rejects foreign, duplicate and multiply-assigned room members", async () => {
    await expect(addRoom("trip", "Room", ["a", "a"])).rejects.toThrow("unique");
    mocks.tx.member.count.mockResolvedValue(1);
    await expect(addRoom("trip", "Room", ["a", "b"])).rejects.toThrow("family");
    mocks.tx.member.count.mockResolvedValue(2);
    mocks.tx.roomMember.count.mockResolvedValue(1);
    await expect(addRoom("trip", "Room", ["a", "b"])).rejects.toThrow(
      "one room",
    );
  });
});
