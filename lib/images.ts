export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export function imageUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/api/images/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function tripCoverKey(trip: {
  coverImageId: string | null;
  images: { id: string; storageKey: string }[];
}): string | null {
  return trip.images.find((image) => image.id === trip.coverImageId)?.storageKey
    ?? trip.images[0]?.storageKey
    ?? null;
}

export async function uploadImage(file: Blob, filename: string): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, WebP or GIF image.");
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be between 1 byte and 12 MB.");
  }
  const data = new FormData();
  data.set("file", file, filename);
  const response = await fetch("/api/upload", { method: "POST", body: data });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = typeof body === "object" && body !== null
      && "error" in body && typeof body.error === "string"
      ? body.error : "Image upload failed. Please try again.";
    throw new Error(message);
  }
  if (typeof body !== "object" || body === null
    || !("key" in body) || typeof body.key !== "string" || !body.key) {
    throw new Error("Image upload returned an invalid response.");
  }
  return body.key;
}
