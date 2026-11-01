import { beforeEach, expect, it, vi } from "vitest";
import { joinFamily } from "./actions";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  createSession: vi.fn(),
  setCookie: vi.fn(),
  family: { findFirst: vi.fn(), findUnique: vi.fn() },
  groupInvitation: { findUnique: vi.fn(), update: vi.fn() },
  userAccount: { findUnique: vi.fn(), create: vi.fn() },
  member: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  db: {
    family: mocks.family,
    groupInvitation: mocks.groupInvitation,
    userAccount: mocks.userAccount,
    member: mocks.member,
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentSession: mocks.session,
  hashToken: (value: string) => `hash:${value}`,
  createSession: mocks.createSession,
  setSessionCookie: mocks.setCookie,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => true }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`Redirect: ${path}`); },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.family.findFirst.mockResolvedValue(null);
  mocks.family.findUnique.mockResolvedValue({ id: "family" });
  mocks.groupInvitation.findUnique.mockResolvedValue({
    id: "invite", familyId: "family", email: null,
    acceptedAt: null, expiresAt: new Date(Date.now() + 86400_000),
  });
  mocks.userAccount.findUnique.mockResolvedValue(null);
  mocks.userAccount.create.mockResolvedValue({ id: "account" });
  mocks.member.findFirst.mockResolvedValue(null);
  mocks.member.create.mockResolvedValue({ id: "new-member" });
  mocks.createSession.mockResolvedValue("session-token");
});

function joinData(email = "alex@example.com") {
  const form = new FormData();
  form.set("token", "shared-link");
  form.set("name", " Alex ");
  form.set("email", email);
  form.set("pin", "123456");
  return form;
}

it("joins with a profile, no photo or household, and no admin approval", async () => {
  await expect(joinFamily({}, joinData())).rejects.toThrow("Redirect: /");
  expect(mocks.member.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      name: "Alex", familyId: "family", photoKey: null,
      householdId: null, isAdmin: false, isDependent: false,
    }),
  });
  expect(mocks.setCookie).toHaveBeenCalledWith("session-token");
});

it("keeps a shared link usable by multiple people", async () => {
  await expect(joinFamily({}, joinData())).rejects.toThrow("Redirect: /");
  await expect(joinFamily({}, joinData("sam@example.com"))).rejects.toThrow("Redirect: /");
  expect(mocks.member.create).toHaveBeenCalledTimes(2);
  expect(mocks.groupInvitation.update).not.toHaveBeenCalled();
});

it("lets a signed-in account join without entering a PIN again", async () => {
  mocks.session.mockResolvedValue({
    member: {
      id: "existing", familyId: "other", userAccountId: "account",
      userAccount: { id: "account", email: "alex@example.com" },
    },
  });
  const data = joinData();
  data.delete("pin");
  await expect(joinFamily({}, data)).rejects.toThrow("Redirect: /");
  expect(mocks.userAccount.create).not.toHaveBeenCalled();
});

it("rejects expired shared invitations", async () => {
  mocks.groupInvitation.findUnique.mockResolvedValue({
    id: "invite", familyId: "family", email: null,
    acceptedAt: null, expiresAt: new Date(0),
  });
  expect(await joinFamily({}, joinData())).toEqual({ message: "Invalid or expired invite link." });
  expect(mocks.member.create).not.toHaveBeenCalled();
});
