import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CostsTab } from "./CostsTab";

vi.mock("./cost-actions", () => ({
  addCostCategory: vi.fn(),
  updateCostCategory: vi.fn(),
  removeCostCategory: vi.fn(),
  addCostLine: vi.fn(),
  updateCostLine: vi.fn(),
  removeCostLine: vi.fn(),
  adjustCost: vi.fn(),
  spreadShortfall: vi.fn(),
  setFxRate: vi.fn(),
  addRoom: vi.fn(),
  removeRoom: vi.fn(),
  setAgeWeights: vi.fn(),
  setBankDetails: vi.fn(),
}));
vi.mock("./PaymentsSection", () => ({
  PaymentsSection: () => <p>Payments rendered</p>,
}));

const props: Parameters<typeof CostsTab>[0] = {
  tripId: "trip",
  currentMemberId: "adult",
  isCaptain: true,
  tripCurrency: "GBP",
  tripStatus: "PLANNING",
  categories: [],
  costOutput: null,
  costError: null,
  members: [
    { id: "adult", name: "Test member", householdId: null, guardianId: null },
  ],
  payments: [],
  adjustments: [],
  fxRates: {},
  ageWeights: { ADULT: 1, CHILD_12_17: 1, CHILD_5_11: 0.5, CHILD_0_4: 0 },
  rooms: [],
  bankDetails: null,
  expenses: [],
};

describe("Costs tab", () => {
  it("keeps failed calculations explicit without fabricated zero balances or a broken payment section", () => {
    const html = renderToStaticMarkup(
      <CostsTab {...props} costError="Check exchange rates" />,
    );
    expect(html).toContain("Check exchange rates");
    expect(html).toContain("Unavailable");
    expect(html).not.toContain("£0.00");
    expect(html).not.toContain("Payments rendered");
    expect(html).toContain("Set exchange rate");
  });
  it("shows the override shortfall and recovery action", () => {
    const html = renderToStaticMarkup(
      <CostsTab
        {...props}
        costOutput={{
          perMember: [
            {
              memberId: "adult",
              totalMinor: 8000,
              nights: 2,
              byCategory: {},
              byLine: {},
              explain: [],
            },
          ],
          totals: {
            estimateMinor: 10000,
            allocatedMinor: 8000,
            unallocatedMinor: 2000,
          },
          warnings: [],
        }}
      />,
    );
    expect(html).toContain("Shortfall: £20.00");
    expect(html).toContain("Spread shortfall");
    expect(html).toContain("Payments rendered");
  });
  it("preserves payment logging when an estimate has not been added", () => {
    const html = renderToStaticMarkup(<CostsTab {...props} />);
    expect(html).toContain("No cost estimate yet");
    expect(html).toContain("Payments rendered");
  });
});
