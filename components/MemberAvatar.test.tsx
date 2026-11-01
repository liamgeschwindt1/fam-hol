import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberAvatar } from "./MemberAvatar";

it("automatically gives members a deterministic emoji with an accessible name", () => {
  const html = renderToStaticMarkup(<MemberAvatar name="Alex" photoKey={null} />);
  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="Alex"');
  expect(html).toMatch(/\p{Extended_Pictographic}/u);
  expect(html).not.toContain(">AL<");
  expect(renderToStaticMarkup(<MemberAvatar name="Alex" photoKey={null} />)).toBe(html);
});

it("uses an optional photo instead of the emoji", () => {
  const html = renderToStaticMarkup(<MemberAvatar name="Alex" photoKey="photos/abc.jpeg" />);
  expect(html).toContain('src="/api/images/photos/abc.jpeg"');
  expect(html).toContain('alt="Alex"');
});
