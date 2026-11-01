import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as download } from "./route";
import { GET as feed } from "@/app/cal/[token]/route";

const mocks = vi.hoisted(() => ({
  trip: { findUnique: vi.fn(), findMany: vi.fn() },
  member: { findUnique: vi.fn() },
  requireMember: vi.fn(),
  computeCosts: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mocks }));
vi.mock("@/lib/auth", () => ({ requireMember: mocks.requireMember }));
vi.mock("@/lib/costs/compute", () => ({ computeCosts: mocks.computeCosts }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", "https://trips.example.test");
  const trip = {
    id: "trip",
    familyId: "family",
    captainId: "captain",
    title: "Test trip",
    placeName: "Test place",
    currency: "GBP",
    revision: 3,
    startDate: new Date("2026-11-01"),
    endDate: new Date("2026-11-03"),
    updatedAt: new Date("2026-11-01"),
    chosenStay: { title: "Test hotel" },
    attendance: [
      {
        date: new Date("2026-11-01"),
        status: "IN",
        updatedAt: new Date("2026-11-01"),
      },
    ],
  };
  mocks.requireMember.mockResolvedValue({
    member: {
      id: "adult",
      calendarShowCosts: true,
      calendarRevision: 0,
      updatedAt: new Date("2026-11-01"),
    },
    family: { id: "family" },
  });
  mocks.member.findUnique.mockResolvedValue({
    id: "adult",
    familyId: "family",
    name: "Test member",
    calendarShowCosts: true,
    calendarRevision: 0,
    updatedAt: new Date("2026-11-01"),
  });
  mocks.trip.findUnique.mockResolvedValue(trip);
  mocks.trip.findMany.mockResolvedValueOnce([trip]).mockResolvedValueOnce([]);
  mocks.computeCosts.mockResolvedValue({
    perMember: [{ memberId: "adult", totalMinor: 12345 }],
  });
});

describe("calendar cost descriptions", () => {
  it("includes the exact member share and configured URL in a trip download", async () => {
    const response = await download(
      new Request("https://internal.test/trips/trip/download-ics"),
      { params: Promise.resolve({ id: "trip" }) },
    );
    const text = (await response.text()).replace(/\r\n[ \t]/g, "");
    expect(text).toContain("Your share: £123.45 GBP");
    expect(text).toContain("https://trips.example.test/trips/trip");
    expect(text).toContain("SEQUENCE:3");
  });
  it("includes the same share in the private subscription feed", async () => {
    const response = await feed(
      new Request("https://internal.test/cal/token.ics"),
      { params: Promise.resolve({ token: "token.ics" }) },
    );
    const text = (await response.text()).replace(/\r\n[ \t]/g, "");
    expect(text).toContain("Your share: £123.45 GBP");
    expect(text).toContain("https://trips.example.test/trips/trip");
  });
  it("omits amounts and cost computation when calendar cost visibility is disabled", async () => {
    mocks.requireMember.mockResolvedValue({
      member: {
        id: "adult",
        calendarShowCosts: false,
        calendarRevision: 1,
        updatedAt: new Date("2026-11-02"),
      },
      family: { id: "family" },
    });
    mocks.member.findUnique.mockResolvedValue({
      id: "adult",
      familyId: "family",
      name: "Test member",
      calendarShowCosts: false,
      calendarRevision: 1,
      updatedAt: new Date("2026-11-02"),
    });
    const request = new Request("https://internal.test/calendar");
    const downloadResponse = await download(request, {
      params: Promise.resolve({ id: "trip" }),
    });
    const feedResponse = await feed(request, {
      params: Promise.resolve({ token: "token.ics" }),
    });
    const downloadText = await downloadResponse.text();
    const feedText = await feedResponse.text();
    expect(downloadText).not.toContain("Your share");
    expect(feedText).not.toContain("Your share");
    expect(downloadText).toContain("SEQUENCE:4");
    expect(feedText).toContain("SEQUENCE:4");
    expect(mocks.computeCosts).not.toHaveBeenCalled();
  });
});
