"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@prisma/client";

const UpdateTripSchema = z.object({
  tripId: z.string(),
  title: z.string().min(1).max(120).optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  season: z
    .enum([
      "SNOW",
      "SURF",
      "EASTER",
      "CHRISTMAS",
      "NYE",
      "SUMMER",
      "CITY",
      "OTHER",
    ])
    .optional(),
  coverImageKey: z.string().optional(),
});

export async function updateTrip(formData: FormData) {
  const { member } = await requireMember();

  const raw = {
    tripId: formData.get("tripId") as string,
    title: (formData.get("title") as string) || undefined,
    tagline: formData.get("tagline") as string | undefined,
    description: (formData.get("description") as string) || undefined,
    startDate: (formData.get("startDate") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
    season: (formData.get("season") as string) || undefined,
    coverImageKey: (formData.get("coverImageKey") as string) || undefined,
  };

  const parsed = UpdateTripSchema.parse(raw);

  const trip = await db.trip.findUniqueOrThrow({
    where: { id: parsed.tripId },
  });

  if (trip.captainId !== member.id) {
    throw new Error("Only the captain can edit this trip");
  }

  const updateData: Record<string, unknown> = {};
  const changes: string[] = [];

  if (parsed.title && parsed.title !== trip.title) {
    updateData.title = parsed.title;
    changes.push("title");
  }
  if (parsed.tagline !== undefined) {
    updateData.tagline = parsed.tagline || null;
    changes.push("tagline");
  }
  if (parsed.description !== undefined) {
    updateData.descriptionMd = parsed.description;
    changes.push("description");
  }
  if (parsed.startDate) {
    updateData.startDate = new Date(parsed.startDate + "T00:00:00Z");
    changes.push("dates");
  }
  if (parsed.endDate) {
    updateData.endDate = new Date(parsed.endDate + "T00:00:00Z");
    changes.push("dates");
  }
  if (parsed.season) {
    updateData.season = parsed.season;
    changes.push("season");
  }

  if (Object.keys(updateData).length === 0 && !parsed.coverImageKey) {
    return;
  }

  const newRevision = trip.revision + 1;
  updateData.revision = newRevision;

  await db.$transaction(async (tx) => {
    // Handle cover image update
    if (parsed.coverImageKey) {
      const imageId = createId();
      await tx.tripImage.create({
        data: {
          id: imageId,
          tripId: trip.id,
          storageKey: parsed.coverImageKey,
          width: 1200,
          height: 800,
          blurDataUrl: "",
          sort: 0,
          uploadedById: member.id,
        },
      });
      updateData.coverImageId = imageId;
      changes.push("cover");
    }

    await tx.trip.update({
      where: { id: trip.id },
      data: updateData,
    });

    // Write revision
    await tx.tripRevision.create({
      data: {
        id: createId(),
        tripId: trip.id,
        revision: newRevision,
        snapshotJson: updateData as Prisma.InputJsonValue,
        actorId: member.id,
        summary: `Updated ${changes.join(", ")}`,
      },
    });

    // Activity log
    await tx.activityLog.create({
      data: {
        id: createId(),
        actorId: member.id,
        type: "TRIP_UPDATED",
        tripId: trip.id,
        payloadJson: { changes } as Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath(`/trips/${trip.id}`);
}

const STATUS_ORDER: readonly string[] = [
  "IDEA",
  "PLANNING",
  "CONFIRMED",
  "HAPPENING",
  "DONE",
  "ARCHIVED",
] as const;

export async function advanceStatus(formData: FormData) {
  const { member } = await requireMember();

  const tripId = formData.get("tripId") as string;
  const newStatus = formData.get("newStatus") as string;

  if (!STATUS_ORDER.includes(newStatus)) {
    throw new Error("Invalid status");
  }

  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
  });

  if (trip.captainId !== member.id) {
    throw new Error("Only the captain can change the status");
  }

  await db.$transaction(async (tx) => {
    await tx.trip.update({
      where: { id: tripId },
      data: {
        status: newStatus as typeof trip.status,
        archivedAt: newStatus === "ARCHIVED" ? new Date() : null,
      },
    });

    await tx.activityLog.create({
      data: {
        id: createId(),
        actorId: member.id,
        type: "STATUS_CHANGED",
        tripId,
        payloadJson: {
          from: trip.status,
          to: newStatus,
        } as Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath(`/trips/${tripId}`);
}
