import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGroupInviteLink } from "./actions";

const mocks = vi.hoisted(() => ({
  requireMember: vi.fn(),
  headers: vi.fn(),
  createInvitation: vi.fn(),
  updateFamily: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireMember: mocks.requireMember,
  hashToken: (token: string) => `hashed:${token}`,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/db", () => ({
  db: {
    groupInvitation: { create: mocks.createInvitation },
    family: { update: mocks.updateFamily },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", "https://example.com");
  mocks.requireMember.mockResolvedValue({
    member: { id: "member", isAdmin: false },
    family: { id: "family" },
  });
  mocks.headers.mockResolvedValue(new Headers());
  mocks.createInvitation.mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());

it("lets ordinary members create reusable links without invalidating previous ones", async () => {
  const first = await createGroupInviteLink();
  const second = await createGroupInviteLink();
  expect(first).toMatch(/^https:\/\/example.com\/join\//);
  expect(second).not.toBe(first);
  expect(mocks.updateFamily).not.toHaveBeenCalled();
  const data = mocks.createInvitation.mock.calls[0]![0].data;
  expect(data.familyId).toBe("family");
  expect(data.email).toBeUndefined();
  expect(data.tokenHash).not.toBe(first.split("/").pop());
  expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
});

it("uses the deployed request origin when APP_URL is absent", async () => {
  vi.stubEnv("APP_URL", undefined);
  mocks.headers.mockResolvedValue(new Headers({
    host: "fam-hol-production.up.railway.app",
    "x-forwarded-proto": "https",
  }));
  expect(await createGroupInviteLink()).toMatch(/^https:\/\/fam-hol-production.up.railway.app\/join\//);
});
