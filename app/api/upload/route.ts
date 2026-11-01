import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getStorage } from "@/lib/storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import sharp from "sharp";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/images";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(IMAGE_TYPES);
const MAX_BYTES = MAX_IMAGE_BYTES;

export async function POST(req: NextRequest) {
  if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(`photo-upload:${ip}`, 20, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many image uploads. Please wait 15 minutes." },
        { status: 429 },
      );
    }
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid image upload." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Choose a JPEG, PNG, WebP or GIF image." }, { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be between 1 byte and 12 MB." }, { status: 400 },
      );
    }
    let image: Buffer;
    try {
      image = await sharp(await file.arrayBuffer(), { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { error: "This image could not be read. Try a different photo." }, { status: 400 },
      );
    }
    const key = `photos/${crypto.randomBytes(16).toString("hex")}.jpeg`;
    try {
      const { client, bucket } = getStorage();
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: image,
        ContentType: "image/jpeg",
        ContentLength: image.length,
      }));
    } catch (error) {
      console.error("Image upload failed", error);
      return NextResponse.json(
        { error: "Image storage is unavailable. Check the S3 configuration or try again later." },
        { status: 503 },
      );
    }
    return NextResponse.json({ key }, { status: 201 });
  }

  let body: { filename?: unknown; contentType?: unknown; size?: unknown };
  try {
    body = await req.json() as { filename?: unknown; contentType?: unknown; size?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contentType, size } = body;

  if (typeof contentType !== "string" || !ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Only image files are allowed (jpeg, png, webp, gif)" },
      { status: 400 },
    );
  }

  if (typeof size !== "number" || size > MAX_BYTES || size <= 0) {
    return NextResponse.json(
      { error: "File must be between 1 byte and 12 MB" },
      { status: 400 },
    );
  }

  const ext = contentType.split("/")[1] ?? "jpg";
  const key = `photos/${crypto.randomBytes(16).toString("hex")}.${ext}`;

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  try {
    const { client: s3 } = getStorage();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 300 });
    return NextResponse.json({ url, key });
  } catch (error) {
    console.error("Image upload URL creation failed", error);
    return NextResponse.json(
      { error: "Image storage is unavailable. Check the S3 configuration." },
      { status: 503 },
    );
  }
}
