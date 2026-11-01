import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "./page";

const mocks = vi.hoisted(() => ({ requireMember: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireMember: mocks.requireMember }));

beforeEach(() => vi.resetAllMocks());

it("shows admins their family and a working management link instead of setup", async () => {
  mocks.requireMember.mockResolvedValue({
    member: { name: "Alex", isAdmin: true },
    family: { name: "The Explorers" },
  });
  const html = renderToStaticMarkup(await HomePage());
  expect(html).toContain("Welcome back, Alex");
  expect(html).toContain("The Explorers");
  expect(html).toContain('href="/admin"');
  expect(html).toContain('href="/trips/new"');
  expect(html).not.toContain('href="/setup"');
  expect(html).not.toContain('href="/join"');
});

it("shows ordinary members profile controls rather than admin controls", async () => {
  mocks.requireMember.mockResolvedValue({
    member: { name: "Sam", isAdmin: false },
    family: { name: "The Explorers" },
  });
  const html = renderToStaticMarkup(await HomePage());
  expect(html).toContain("Your profile &amp; preferences");
  expect(html).not.toContain('href="/admin"');
});
