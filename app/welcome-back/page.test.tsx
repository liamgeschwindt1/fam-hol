import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import WelcomeBackPage from "./page";

const mocks = vi.hoisted(() => ({
  findFamily: vi.fn(),
  findMembers: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    family: { findFirst: mocks.findFamily },
    member: { findMany: mocks.findMembers },
  },
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./MemberGrid", () => ({ default: () => <div>Member picker</div> }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`Redirect: ${path}`);
  });
});

describe("first-time entry", () => {
  it("sends an empty installation straight to setup", async () => {
    mocks.findFamily.mockResolvedValue(null);

    await expect(WelcomeBackPage()).rejects.toThrow("Redirect: /setup");
    expect(mocks.redirect).toHaveBeenCalledWith("/setup");
    expect(mocks.findMembers).not.toHaveBeenCalled();
  });

  it("keeps the member picker for an existing family", async () => {
    mocks.findFamily.mockResolvedValue({ name: "Test family" });
    mocks.findMembers.mockResolvedValue([
      { id: "member", name: "Admin", photoKey: null, pinHash: null },
    ]);

    const html = renderToStaticMarkup(await WelcomeBackPage());
    expect(html).toContain("Test family");
    expect(html).toContain("Who are you?");
    expect(html).toContain("Member picker");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps the existing empty-member message without reopening setup", async () => {
    mocks.findFamily.mockResolvedValue({ name: "Test family" });
    mocks.findMembers.mockResolvedValue([]);

    const html = renderToStaticMarkup(await WelcomeBackPage());
    expect(html).toContain("No members yet. Ask your admin for an invite link.");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("propagates database errors instead of treating them as an empty installation", async () => {
    mocks.findFamily.mockRejectedValue(new Error("Database unavailable"));

    await expect(WelcomeBackPage()).rejects.toThrow("Database unavailable");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
