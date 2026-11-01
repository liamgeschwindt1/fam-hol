import { afterEach, expect, it, vi } from "vitest";
import { imageUrl, tripCoverKey, uploadImage, MAX_IMAGE_BYTES } from "./images";

afterEach(() => vi.unstubAllGlobals());

it("uses same-origin image URLs without a public S3 base URL", () => {
  expect(imageUrl("photos/abc.jpeg")).toBe("/api/images/photos/abc.jpeg");
  expect(imageUrl(null)).toBeNull();
});

it("displays the selected cover rather than the oldest photo", () => {
  const images = [
    { id: "old", storageKey: "old.jpeg" },
    { id: "new", storageKey: "new.jpeg" },
  ];
  expect(tripCoverKey({ coverImageId: "new", images })).toBe("new.jpeg");
  expect(tripCoverKey({ coverImageId: null, images })).toBe("old.jpeg");
  expect(tripCoverKey({ coverImageId: null, images: [] })).toBeNull();
});

it("uploads the actual file before returning its storage key", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ key: "photos/saved.jpeg" }, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  const file = new Blob(["photo bytes"], { type: "image/jpeg" });
  expect(await uploadImage(file, "cover.jpg")).toBe("photos/saved.jpeg");
  const [url, options] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/upload");
  expect(options.method).toBe("POST");
  expect(options.body).toBeInstanceOf(FormData);
  expect(await options.body.get("file").text()).toBe("photo bytes");
});

it("surfaces upload failures and malformed success responses", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "Storage unavailable" }, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  const file = new Blob(["photo"], { type: "image/png" });
  await expect(uploadImage(file, "photo.png")).rejects.toThrow("Storage unavailable");
  fetchMock.mockResolvedValue(Response.json({}));
  await expect(uploadImage(file, "photo.png")).rejects.toThrow("invalid response");
});

it("rejects unsupported, empty and oversized files before uploading", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(uploadImage(new Blob(["x"], { type: "text/plain" }), "x.txt")).rejects.toThrow("Choose a JPEG");
  await expect(uploadImage(new Blob([], { type: "image/jpeg" }), "empty.jpg")).rejects.toThrow("12 MB");
  await expect(uploadImage(new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: "image/jpeg" }), "large.jpg")).rejects.toThrow("12 MB");
  expect(fetchMock).not.toHaveBeenCalled();
});
