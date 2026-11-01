import { expect, it } from "vitest";
import { groupInviteEmailUrl } from "./invitations";

it("opens an encoded email draft with the group link, not an email delivery service", () => {
  const link = "https://example.com/join/token";
  const url = groupInviteEmailUrl("Friends & family", link, " alex+test@example.com ");
  expect(url).toMatch(/^mailto:alex%2Btest%40example.com\?/);
  const query = new URLSearchParams(url.split("?")[1]);
  expect(query.get("subject")).toBe("Join Friends & family");
  expect(query.get("body")).toContain(link);
  expect(query.get("body")).toContain("Create your profile");
});

it("allows choosing recipients inside the email app", () => {
  expect(groupInviteEmailUrl("Friends", "https://example.com/join/token")).toMatch(/^mailto:\?/);
});
