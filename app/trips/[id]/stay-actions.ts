"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";

const AddStayOptionSchema = z.object({
  tripId: z.string().min(1),
  title: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  priceNote: z.string().max(200).optional(),
  totalPriceMinor: z.coerce.number().int().optional(),
  currency: z.string().max(3).optional(),
  nights: z.coerce.number().int().positive().optional(),
  rooms: z.coerce.number().int().positive().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  pros: z.string().max(1000).optional(),
  cons: z.string().max(1000).optional(),
});

function extractDomain(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function addStayOption(formData: FormData) {
  const { member, family } = await requireMember();

  const raw = {
    tripId: formData.get("tripId") as string,
    title: formData.get("title") as string,
    url: formData.get("url") as string,
    priceNote: (formData.get("priceNote") as string) || undefined,
    totalPriceMinor: (formData.get("totalPriceMinor") as string) || undefined,
    currency: (formData.get("currency") as string) || undefined,
    nights: (formData.get("nights") as string) || undefined,
    rooms: (formData.get("rooms") as string) || undefined,
    capacity: (formData.get("capacity") as string) || undefined,
    pros: (formData.get("pros") as string) || undefined,
    cons: (formData.get("cons") as string) || undefined,
  };

  const parsed = AddStayOptionSchema.parse(raw);

  const trip = await db.trip.findUniqueOrThrow({
    where: { id: parsed.tripId },
  });
  if (trip.familyId !== family.id) {
    throw new Error("Access denied");
  }

  await db.stayOption.create({
    data: {
      id: createId(),
      tripId: parsed.tripId,
      title: parsed.title,
      url: parsed.url,
      sourceDomain: extractDomain(parsed.url),
      priceNote: parsed.priceNote || null,
      totalPriceMinor: parsed.totalPriceMinor ?? null,
      currency: parsed.currency || null,
      nights: parsed.nights ?? null,
      rooms: parsed.rooms ?? null,
      capacity: parsed.capacity ?? null,
      pros: parsed.pros || null,
      cons: parsed.cons || null,
      addedById: member.id,
    },
  });

  await db.activityLog.create({
    data: {
      id: createId(),
      actorId: member.id,
      type: "STAY_OPTION_ADDED",
      tripId: parsed.tripId,
      payloadJson: { title: parsed.title },
    },
  });

  revalidatePath(`/trips/${parsed.tripId}`);
}

export async function voteOnStay(
  stayOptionId: string,
  value: "UP" | "NEUTRAL" | "DOWN",
) {
  const { member, family } = await requireMember();

  const option = await db.stayOption.findUniqueOrThrow({
    where: { id: stayOptionId },
    include: { trip: { select: { familyId: true, id: true } } },
  });

  if (option.trip.familyId !== family.id) {
    throw new Error("Access denied");
  }

  await db.stayVote.upsert({
    where: {
      stayOptionId_memberId: { stayOptionId, memberId: member.id },
    },
    create: { stayOptionId, memberId: member.id, value },
    update: { value },
  });

  revalidatePath(`/trips/${option.trip.id}`);
}

export async function chooseStay(tripId: string, stayOptionId: string | null) {
  const { member, family } = await requireMember();

  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
  });
  if (trip.familyId !== family.id) {
    throw new Error("Access denied");
  }
  if (trip.captainId !== member.id) {
    throw new Error("Only the captain can choose the stay");
  }

  await db.trip.update({
    where: { id: tripId },
    data: { chosenStayId: stayOptionId },
  });

  revalidatePath(`/trips/${tripId}`);
}
