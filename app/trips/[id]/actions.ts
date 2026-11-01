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
  startDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
  endDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
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
}).superRefine(({ startDate, endDate }, ctx) => {
  if (Boolean(startDate) !== Boolean(endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add both dates or leave both blank.",
      path: [startDate ? "endDate" : "startDate"],
    });
  } else if (startDate && endDate && endDate < startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    });
  }
});

export async function updateTrip(formData: FormData) {
  const { member } = await requireMember();

  const raw = {
    tripId: formData.get("tripId") as string,
    title: (formData.get("title") as string) || undefined,
    tagline: formData.get("tagline") as string | undefined,
    description: (formData.get("description") as string) || undefined,
    startDate: (formData.get("startDate") as string) ?? "",
    endDate: (formData.get("endDate") as string) ?? "",
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
  const nextStartDate = parsed.startDate
    ? new Date(parsed.startDate + "T00:00:00Z")
    : null;
  const nextEndDate = parsed.endDate
    ? new Date(parsed.endDate + "T00:00:00Z")
    : null;
  if (
    nextStartDate?.getTime() !== trip.startDate?.getTime() ||
    nextEndDate?.getTime() !== trip.endDate?.getTime()
  ) {
    if (!nextStartDate && !nextEndDate) {
      const [attendanceCount, programCount] = await Promise.all([
        db.attendance.count({ where: { tripId: trip.id } }),
        db.programItem.count({ where: { tripId: trip.id } }),
      ]);
      if (attendanceCount || programCount) {
        throw new Error("Remove scheduled attendance and program items before clearing trip dates.");
      }
    }
    updateData.startDate = nextStartDate;
    updateData.endDate = nextEndDate;
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
  if (newStatus === "CONFIRMED" && (!trip.startDate || !trip.endDate)) {
    throw new Error("Add trip dates before confirming the trip.");
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

export async function inviteTripMembers(formData: FormData) {
  const { member, family } = await requireMember();
  const tripId = z.string().min(1).parse(formData.get("tripId"));
  const memberIds = z
    .array(z.string().min(1))
    .min(1)
    .parse(formData.getAll("memberId"));
  const trip = await db.trip.findFirst({
    where: { id: tripId, familyId: family.id },
    select: { id: true },
  });
  if (!trip) throw new Error("Trip not found in your group.");

  const invitees = await db.member.findMany({
    where: { id: { in: memberIds }, familyId: family.id, isDependent: false },
    select: { id: true },
  });
  if (invitees.length !== new Set(memberIds).size) {
    throw new Error("One or more selected members are not in your group.");
  }

  await db.$transaction(
    invitees.map(({ id }) =>
      db.tripParticipant.upsert({
        where: { tripId_memberId: { tripId, memberId: id } },
        create: { tripId, memberId: id, invitedById: member.id },
        update: {},
      }),
    ),
  );
  revalidatePath(`/trips/${tripId}`);
}

export async function respondToTripInvitation(formData: FormData) {
  const { member, family } = await requireMember();
  const tripId = z.string().min(1).parse(formData.get("tripId"));
  const status = z.enum(["IN", "MAYBE", "OUT"]).parse(formData.get("status"));
  const participant = await db.tripParticipant.findFirst({
    where: {
      tripId,
      memberId: member.id,
      trip: { familyId: family.id },
    },
    select: { tripId: true },
  });
  if (!participant) throw new Error("You have not been invited to this trip.");

  await db.tripParticipant.update({
    where: { tripId_memberId: { tripId, memberId: member.id } },
    data: { status },
  });
  revalidatePath(`/trips/${tripId}`);
}
