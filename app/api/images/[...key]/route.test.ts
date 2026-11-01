import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const send = vi.hoisted(() => vi.fn());
const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  tripImage: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    member: { findFirst: mocks.profile },
    tripImage: { findFirst: mocks.tripImage },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ bucket: "photos", client: { send } }),
}));
const key = ["photos", "a".repeat(32) + ".jpeg"];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.profile.mockResolvedValue({ id: "profile" });
});

it("serves image bytes from a private bucket through the app", async () => {
  send.mockResolvedValue({
    ContentType: "image/jpeg",
    Body: { transformToWebStream: () => new Blob(["photo bytes"]).stream() },
  });
  const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ key }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  expect(await response.text()).toBe("photo bytes");
});

it("does not expose other bucket objects", async () => {
  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ key: ["payments", "proof.pdf"] }),
  });
  expect(response.status).toBe(404);
  expect(send).not.toHaveBeenCalled();
});

it("returns not found for a missing image", async () => {
  send.mockRejectedValue(Object.assign(new Error("Missing"), { name: "NoSuchKey" }));
  const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ key }) });
  expect(response.status).toBe(404);
});

it("restricts trip covers to members of the image's group", async () => {
  mocks.profile.mockResolvedValue(null);
  mocks.session.mockResolvedValue({ member: { familyId: "family" } });
  mocks.tripImage.mockResolvedValue(null);
  const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ key }) });
  expect(response.status).toBe(404);
  expect(mocks.tripImage).toHaveBeenCalledWith({
    where: { storageKey: key.join("/"), trip: { familyId: "family" } },
    select: { id: true },
  });
  expect(send).not.toHaveBeenCalled();
});

it("does not expose unreferenced uploads or payment proofs to signed-out visitors", async () => {
  mocks.profile.mockResolvedValue(null);
  mocks.session.mockResolvedValue(null);
  const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ key }) });
  expect(response.status).toBe(401);
  expect(send).not.toHaveBeenCalled();
});
