import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });
}

export async function POST(req: NextRequest) {
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

  const s3 = getS3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 300 });

  return NextResponse.json({ url, key });
}
