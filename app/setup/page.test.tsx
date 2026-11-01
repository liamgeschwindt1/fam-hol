import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SetupPage from "./page";

const mocks = vi.hoisted(() => ({
  family: vi.fn(),
  requireMember: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { family: { findFirst: mocks.family } } }));
vi.mock("@/lib/auth", () => ({ requireMember: mocks.requireMember }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./SetupForm", () => ({ default: () => <form>Create family space</form> }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`Redirect: ${path}`);
  });
});

it("renders setup without requiring a session when no family exists", async () => {
  mocks.family.mockResolvedValue(null);
  expect(renderToStaticMarkup(await SetupPage())).toContain("Create your family space");
  expect(mocks.requireMember).not.toHaveBeenCalled();
});

it.each([
  [true, "/admin"],
  [false, "/trips"],
])("routes existing family members by admin status %s", async (isAdmin, path) => {
  mocks.family.mockResolvedValue({ id: "family" });
  mocks.requireMember.mockResolvedValue({ member: { isAdmin } });
  await expect(SetupPage()).rejects.toThrow(`Redirect: ${path}`);
});

it("requires sign-in rather than bouncing signed-out visitors back home", async () => {
  mocks.family.mockResolvedValue({ id: "family" });
  mocks.requireMember.mockImplementation(() => mocks.redirect("/welcome-back"));
  await expect(SetupPage()).rejects.toThrow("Redirect: /welcome-back");
});
