import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MePage from "./page";

const mocks = vi.hoisted(() => ({
  requireMember: vi.fn(),
  member: { findFirstOrThrow: vi.fn() },
  trip: { findMany: vi.fn() },
  computeCosts: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireMember: mocks.requireMember }));
vi.mock("@/lib/db", () => ({ db: mocks }));
vi.mock("@/lib/costs/compute", () => ({ computeCosts: mocks.computeCosts }));
vi.mock("./ProfileActions", () => ({ ProfileActions: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireMember.mockResolvedValue({
    member: { id: "adult", name: "Test member" },
    family: { id: "family", homeCurrency: "GBP", secondCurrency: "EUR" },
  });
  mocks.member.findFirstOrThrow.mockResolvedValue({
    name: "Test member",
    calendarToken: "test",
    household: null,
    dependents: [{ id: "child", name: "Test dependent" }],
  });
  mocks.trip.findMany.mockResolvedValue([
    {
      id: "trip",
      title: "Test trip",
      status: "DONE",
      currency: "GBP",
      fxRatesJson: { EUR: 1.15 },
      costCategories: [{ id: "stay", name: "Accommodation" }],
      payments: [
        {
          fromMemberId: "adult",
          amountMinor: 5750,
          currency: "EUR",
          confirmedAt: new Date(),
        },
      ],
    },
  ]);
  mocks.computeCosts.mockResolvedValue({
    perMember: [
      {
        memberId: "adult",
        totalMinor: 10000,
        nights: 2,
        byCategory: { stay: 10000 },
        explain: [{ description: "Villa: two nights, £100.00" }],
      },
      {
        memberId: "child",
        totalMinor: 5000,
        nights: 1,
        byCategory: { stay: 5000 },
        explain: [{ description: "Villa: child discount, £50.00" }],
      },
    ],
  });
});

describe("My commitments screen", () => {
  it("shows rolled-up totals, converted payments, dependent explanations and honest settlement status", async () => {
    const html = renderToStaticMarkup(await MePage());
    expect(html).toContain("£100.00 outstanding");
    expect(html).toContain("£150.00 committed");
    expect(html).toContain("£50.00 paid");
    expect(html).toContain("€115.00 outstanding");
    expect(html).toContain("Show how this is worked out");
    expect(html).toContain("Villa: child discount");
    expect(html).toContain("Confirmed");
    expect(html).not.toContain("Settled");
    expect(mocks.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ familyId: "family" }),
      }),
    );
  });
  it("shows calculation failures instead of invented zero balances", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.computeCosts.mockRejectedValue(new Error("Calculation failed"));
    const html = renderToStaticMarkup(await MePage());
    expect(html).toContain("costs are unavailable");
    expect(html).not.toContain("£0.00");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
  it("shows an explicit missing-rate message without mixing summary currencies", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const trips = await mocks.trip.findMany();
    mocks.trip.findMany.mockResolvedValue([
      { ...trips[0], fxRatesJson: {}, payments: [] },
    ]);
    const html = renderToStaticMarkup(await MePage());
    expect(html).toContain("£150.00 outstanding");
    expect(html).toContain("Set the trips");
    expect(html).not.toContain("€150.00");
    log.mockRestore();
  });
});
