"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@prisma/client";

const CreateTripSchema = z.object({
  title: z.string().min(1).max(120),
  destination: z.string().max(200).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(5000).optional(),
  coverImageKey: z.string().optional(),
  season: z.enum([
    "SNOW",
    "SURF",
    "EASTER",
    "CHRISTMAS",
    "NYE",
    "SUMMER",
    "CITY",
    "OTHER",
  ]),
  tagline: z.string().max(200).optional(),
});

export async function createTrip(formData: FormData) {
  const { member, family } = await requireMember();

  const raw = {
    title: formData.get("title") as string,
    destination: formData.get("destination") as string,
    startDate: formData.get("startDate") as string,
    endDate: formData.get("endDate") as string,
    description: formData.get("description") as string,
    coverImageKey: formData.get("coverImageKey") as string,
    season: formData.get("season") as string,
    tagline: formData.get("tagline") as string,
  };

  const parsed = CreateTripSchema.parse(raw);

  const start = new Date(parsed.startDate + "T00:00:00Z");
  const end = new Date(parsed.endDate + "T00:00:00Z");

  if (end < start) {
    throw new Error("End date must be after start date");
  }

  const tripId = createId();

  const defaultCategories = [
    "Accommodation",
    "Travel",
    "Food & drink",
    "Activities",
    "Transport on site",
    "Other",
  ];

  await db.$transaction(async (tx) => {
    await tx.trip.create({
      data: {
        id: tripId,
        familyId: family.id,
        captainId: member.id,
        title: parsed.title,
        tagline: parsed.tagline || null,
        descriptionMd: parsed.description || "",
        season: parsed.season,
        status: "IDEA",
        placeName: parsed.destination || null,
        startDate: start,
        endDate: end,
        currency: family.homeCurrency,
        ageWeightsJson: {
          ADULT: 1,
          CHILD_12_17: 1,
          CHILD_5_11: 0.5,
          CHILD_0_4: 0,
        },
      },
    });

    // Create cover image if provided
    if (parsed.coverImageKey) {
      const imageId = createId();
      await tx.tripImage.create({
        data: {
          id: imageId,
          tripId,
          storageKey: parsed.coverImageKey,
          width: 1200,
          height: 800,
          blurDataUrl: "",
          sort: 0,
          uploadedById: member.id,
        },
      });
      await tx.trip.update({
        where: { id: tripId },
        data: { coverImageId: imageId },
      });
    }

    // Create default cost categories
    for (let i = 0; i < defaultCategories.length; i++) {
      await tx.costCategory.create({
        data: {
          id: createId(),
          tripId,
          name: defaultCategories[i]!,
          isAccommodation: i === 0,
          sort: i,
        },
      });
    }

    // Activity log
    await tx.activityLog.create({
      data: {
        id: createId(),
        actorId: member.id,
        type: "TRIP_CREATED",
        tripId,
        payloadJson: { title: parsed.title } as Prisma.InputJsonValue,
      },
    });

    // Create initial trip revision
    await tx.tripRevision.create({
      data: {
        id: createId(),
        tripId,
        revision: 1,
        snapshotJson: { title: parsed.title } as Prisma.InputJsonValue,
        actorId: member.id,
        summary: "Trip created",
      },
    });
  });

  redirect(`/trips/${tripId}`);
}
