import { beforeEach, expect, it, vi } from "vitest";
import { setupFamily } from "./actions";

const mocks = vi.hoisted(() => ({
  family: vi.fn(),
  createFamily: vi.fn(),
  createMember: vi.fn(),
  transaction: vi.fn(),
  requireMember: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    family: { findFirst: mocks.family, create: mocks.createFamily },
    member: { create: mocks.createMember },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/auth", () => ({
  requireMember: mocks.requireMember,
  hashToken: () => "hashed-token",
  createSession: mocks.createSession,
  setSessionCookie: mocks.setSessionCookie,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.family.mockResolvedValue(null);
  mocks.createSession.mockResolvedValue("session-token");
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`Redirect: ${path}`);
  });
});

function setupData() {
  const data = new FormData();
  data.set("familyName", " The Explorers ");
  data.set("adminName", " Alex ");
  data.set("homeCurrency", "GBP");
  data.set("secondCurrency", "");
  data.set("photoKey", "");
  return data;
}

it("accepts no second currency or photo and takes the new admin to invitations", async () => {
  await expect(setupFamily({}, setupData())).rejects.toThrow("Redirect: /admin");
  expect(mocks.createFamily).toHaveBeenCalledWith({
    data: expect.objectContaining({ name: "The Explorers", secondCurrency: null }),
  });
  expect(mocks.createMember).toHaveBeenCalledWith({
    data: expect.objectContaining({ name: "Alex", isAdmin: true, photoKey: null }),
  });
  expect(mocks.transaction).toHaveBeenCalledOnce();
  expect(mocks.setSessionCookie).toHaveBeenCalledWith("session-token");
});

it("rejects whitespace-only names before writing", async () => {
  const data = setupData();
  data.set("familyName", " ");
  expect(await setupFamily({}, data)).toEqual({
    errors: { familyName: ["Family name is required"] },
  });
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it.each([
  [true, "/admin"],
  [false, "/trips"],
])("does not recreate an existing family for admin status %s", async (isAdmin, path) => {
  mocks.family.mockResolvedValue({ id: "family" });
  mocks.requireMember.mockResolvedValue({ member: { isAdmin } });
  await expect(setupFamily({}, setupData())).rejects.toThrow(`Redirect: ${path}`);
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it("does not create a session when the database transaction fails", async () => {
  mocks.transaction.mockRejectedValue(new Error("Database unavailable"));
  await expect(setupFamily({}, setupData())).rejects.toThrow("Database unavailable");
  expect(mocks.createSession).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
