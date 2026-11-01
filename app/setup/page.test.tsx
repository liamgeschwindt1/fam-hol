import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SetupPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./SetupForm", () => ({ default: () => <form>Create family space</form> }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentSession.mockResolvedValue(null);
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`Redirect: ${path}`);
  });
});

it("renders setup without requiring a session when no family exists", async () => {
  expect(renderToStaticMarkup(await SetupPage())).toContain("Create your family space");
});

it.each([
  [{ userAccountId: "account" }, "/groups/new"],
  [{ userAccountId: null }, "/me"],
])("routes signed-in profiles to the appropriate next step", async (member, path) => {
  mocks.getCurrentSession.mockResolvedValue({ member });
  await expect(SetupPage()).rejects.toThrow(`Redirect: ${path}`);
});

it("requires sign-in rather than bouncing signed-out visitors back home", async () => {
  expect(renderToStaticMarkup(await SetupPage())).toContain("Create your family space");
});
