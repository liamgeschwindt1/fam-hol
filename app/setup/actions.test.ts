import { beforeEach, expect, it, vi } from "vitest";
import { setupFamily } from "./actions";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  findAccount: vi.fn(),
  createAccount: vi.fn(),
  createFamily: vi.fn(),
  createMember: vi.fn(),
  transaction: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    userAccount: { findUnique: mocks.findAccount, create: mocks.createAccount },
    family: { create: mocks.createFamily },
    member: { create: mocks.createMember },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentSession: mocks.getCurrentSession,
  hashToken: () => "hashed-token",
  createSession: mocks.createSession,
  setSessionCookie: mocks.setSessionCookie,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findAccount.mockResolvedValue(null);
  mocks.getCurrentSession.mockResolvedValue(null);
  mocks.transaction.mockResolvedValue([]);
  mocks.createSession.mockResolvedValue("session-token");
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`Redirect: ${path}`);
  });
});

function setupData() {
  const data = new FormData();
  data.set("familyName", " The Explorers ");
  data.set("adminName", " Alex ");
  data.set("email", "alex@example.com");
  data.set("pin", "569156");
  data.set("homeCurrency", "GBP");
  data.set("secondCurrency", "");
  data.set("photoKey", "");
  return data;
}

it("creates a group and account without optional currency or photo", async () => {
  await expect(setupFamily({}, setupData())).rejects.toThrow("Redirect: /");
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

it("allows creating another group even when other groups already exist", async () => {
  await expect(setupFamily({}, setupData())).rejects.toThrow("Redirect: /");
  expect(mocks.transaction).toHaveBeenCalledOnce();
});

it("does not create a session when the database transaction fails", async () => {
  mocks.transaction.mockRejectedValue(new Error("Database unavailable"));
  await expect(setupFamily({}, setupData())).rejects.toThrow("Database unavailable");
  expect(mocks.createSession).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
