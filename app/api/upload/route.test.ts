import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  storage: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({ getStorage: mocks.storage }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rateLimit }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rateLimit.mockReturnValue(true);
  mocks.storage.mockReturnValue({ bucket: "photos", client: { send: mocks.send } });
  mocks.send.mockResolvedValue({});
});

function uploadRequest(file: Blob) {
  const body = new FormData();
  body.set("file", file, "photo.png");
  return new NextRequest("http://localhost/api/upload", { method: "POST", body });
}

it("decodes and stores the actual image bytes before reporting success", async () => {
  const png = await sharp({
    create: { width: 8, height: 4, channels: 3, background: "#168B91" },
  }).png().toBuffer();
  const response = await POST(uploadRequest(new Blob([new Uint8Array(png)], { type: "image/png" })));
  expect(response.status).toBe(201);
  const { key } = await response.json();
  expect(key).toMatch(/^photos\/[a-f0-9]{32}\.jpeg$/);
  const command = mocks.send.mock.calls[0]![0];
  expect(command).toBeInstanceOf(PutObjectCommand);
  expect(command.input.Key).toBe(key);
  expect(command.input.ContentType).toBe("image/jpeg");
  const metadata = await sharp(command.input.Body).metadata();
  expect(metadata.format).toBe("jpeg");
  expect(metadata.width).toBe(8);
});

it("does not report success when storage fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "white" },
  }).png().toBuffer();
  mocks.send.mockRejectedValue(new Error("Storage offline"));
  const response = await POST(uploadRequest(new Blob([new Uint8Array(png)], { type: "image/png" })));
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain("storage is unavailable");
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});

it("rejects corrupt images without contacting storage", async () => {
  const response = await POST(uploadRequest(new Blob(["not a photo"], { type: "image/jpeg" })));
  expect(response.status).toBe(400);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("rate-limits unauthenticated signup photo uploads", async () => {
  mocks.rateLimit.mockReturnValue(false);
  const response = await POST(uploadRequest(new Blob(["x"], { type: "image/png" })));
  expect(response.status).toBe(429);
  expect(mocks.send).not.toHaveBeenCalled();
});
