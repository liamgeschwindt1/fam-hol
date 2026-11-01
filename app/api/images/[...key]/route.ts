import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getStorage } from "@/lib/storage";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const storageKey = key.join("/");
  if (!/^photos\/[a-f0-9]{32}\.(jpeg|jpg|png|webp|gif)$/.test(storageKey)) {
    return new Response("Image not found.", { status: 404 });
  }
  try {
    const profile = await db.member.findFirst({
      where: { photoKey: storageKey },
      select: { id: true },
    });
    if (!profile) {
      const session = await getCurrentSession();
      if (!session) return new Response("Sign in to view this image.", { status: 401 });
      const tripImage = await db.tripImage.findFirst({
        where: { storageKey, trip: { familyId: session.member.familyId } },
        select: { id: true },
      });
      if (!tripImage) return new Response("Image not found.", { status: 404 });
    }
    const { client, bucket } = getStorage();
    const image = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }));
    if (!image.Body) {
      console.error("Image storage returned an empty body", { storageKey });
      return new Response("Image unavailable.", { status: 502 });
    }
    return new Response(image.Body.transformToWebStream(), {
      headers: {
        "Content-Type": image.ContentType ?? "image/jpeg",
        "Cache-Control": profile ? "public, max-age=86400" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return new Response("Image not found.", { status: 404 });
    }
    console.error("Image retrieval failed", { storageKey, error });
    return new Response("Image storage unavailable.", { status: 503 });
  }
}
