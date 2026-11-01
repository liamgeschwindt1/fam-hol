import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TripsPage from "./page";
import MapPage from "../map/page";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { trip: { findMany } } }));
vi.mock("@/lib/auth", () => ({
  requireMember: async () => ({ family: { id: "family" } }),
}));
vi.mock("@/components/TripCard", () => ({
  TripCard: ({ coverUrl }: { coverUrl: string }) => <div>{coverUrl}</div>,
}));
vi.mock("@/components/LazyTripMap", () => ({
  TripMap: ({ trips }: { trips: { coverUrl: string }[] }) => <div>{trips[0]?.coverUrl}</div>,
}));

beforeEach(() => {
  vi.resetAllMocks();
  findMany.mockResolvedValueOnce([{
    id: "trip", title: "Holiday", familyId: "family", season: "SURF",
    status: "IDEA", startDate: null, endDate: null, lat: 1, lng: 2,
    captain: { name: "Alex", photoKey: null }, attendance: [],
    coverImageId: "new",
    images: [
      { id: "old", storageKey: "photos/old.jpeg" },
      { id: "new", storageKey: "photos/new.jpeg" },
    ],
  }]).mockResolvedValueOnce([]);
});

it.each([
  ["Trips", TripsPage],
  ["Map", MapPage],
] as const)("removes season/status bars and uses the chosen cover on %s", async (_name, Page) => {
  const html = renderToStaticMarkup(await Page({
    searchParams: Promise.resolve({ season: "SNOW", status: "DONE", year: undefined }),
  }));
  expect(html).not.toContain(">Season<");
  expect(html).not.toContain(">Status<");
  expect(html).not.toContain("season=SNOW");
  expect(html).not.toContain("status=DONE");
  expect(findMany.mock.calls[0]![0].where).not.toHaveProperty("season");
  expect(findMany.mock.calls[0]![0].where).not.toHaveProperty("status");
  expect(html).toContain("/api/images/photos/new.jpeg");
  expect(html).not.toContain("/api/images/photos/old.jpeg");
});
