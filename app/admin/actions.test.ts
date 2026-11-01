import { beforeEach, expect, it, vi } from "vitest";
import { regenerateInviteToken } from "./actions";

const mocks = vi.hoisted(() => ({
  requireMember: vi.fn(),
  updateFamily: vi.fn(),
  hashToken: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { family: { update: mocks.updateFamily } } }));
vi.mock("@/lib/auth", () => ({
  requireMember: mocks.requireMember,
  hashToken: mocks.hashToken,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireMember.mockResolvedValue({
    member: { isAdmin: true },
    family: { id: "family" },
  });
  mocks.hashToken.mockReturnValue("hashed-invite");
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`Redirect: ${path}`);
  });
});

it("returns a usable raw invite to the admin while storing only its hash", async () => {
  const token = await regenerateInviteToken();
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(mocks.hashToken).toHaveBeenCalledWith(token);
  expect(mocks.updateFamily).toHaveBeenCalledWith({
    where: { id: "family" },
    data: { inviteTokenHash: "hashed-invite" },
  });
  expect(mocks.redirect).not.toHaveBeenCalled();
});

it("does not expose or regenerate invites for non-admins", async () => {
  mocks.requireMember.mockResolvedValue({
    member: { isAdmin: false },
    family: { id: "family" },
  });
  await expect(regenerateInviteToken()).rejects.toThrow("Redirect: /");
  expect(mocks.updateFamily).not.toHaveBeenCalled();
});

it("does not return a success-shaped token when persistence fails", async () => {
  mocks.updateFamily.mockRejectedValue(new Error("Database unavailable"));
  await expect(regenerateInviteToken()).rejects.toThrow("Database unavailable");
});
