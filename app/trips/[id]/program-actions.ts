"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";

const ProgramItemSchema = z.object({
  tripId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().max(10).optional(),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  placeName: z.string().max(200).optional(),
  url: z.string().url().max(2000).optional().or(z.literal("")),
});

async function requireCaptain(tripId: string) {
  const { member, family } = await requireMember();
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
  });
  if (trip.familyId !== family.id) {
    throw new Error("Access denied");
  }
  if (trip.captainId !== member.id) {
    throw new Error("Only the captain can manage the program");
  }
  return { member, trip };
}

export async function addProgramItem(formData: FormData) {
  const raw = {
    tripId: formData.get("tripId") as string,
    date: formData.get("date") as string,
    time: (formData.get("time") as string) || undefined,
    title: formData.get("title") as string,
    notes: (formData.get("notes") as string) || undefined,
    placeName: (formData.get("placeName") as string) || undefined,
    url: (formData.get("url") as string) || undefined,
  };

  const parsed = ProgramItemSchema.parse(raw);
  const { member } = await requireCaptain(parsed.tripId);

  // Get next sort order
  const last = await db.programItem.findFirst({
    where: { tripId: parsed.tripId, date: new Date(parsed.date + "T00:00:00Z") },
    orderBy: { sort: "desc" },
    select: { sort: true },
  });

  await db.programItem.create({
    data: {
      id: createId(),
      tripId: parsed.tripId,
      date: new Date(parsed.date + "T00:00:00Z"),
      time: parsed.time || null,
      title: parsed.title,
      notes: parsed.notes || null,
      placeName: parsed.placeName || null,
      url: parsed.url || null,
      sort: (last?.sort ?? -1) + 1,
    },
  });

  await db.activityLog.create({
    data: {
      id: createId(),
      actorId: member.id,
      type: "PROGRAM_ITEM_ADDED",
      tripId: parsed.tripId,
      payloadJson: { title: parsed.title },
    },
  });

  revalidatePath(`/trips/${parsed.tripId}`);
}

const UpdateProgramItemSchema = z.object({
  itemId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().max(10).optional(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
  placeName: z.string().max(200).optional(),
  url: z.string().url().max(2000).optional().or(z.literal("")),
});

export async function updateProgramItem(formData: FormData) {
  const raw = {
    itemId: formData.get("itemId") as string,
    date: (formData.get("date") as string) || undefined,
    time: formData.get("time") as string | undefined,
    title: (formData.get("title") as string) || undefined,
    notes: formData.get("notes") as string | undefined,
    placeName: formData.get("placeName") as string | undefined,
    url: formData.get("url") as string | undefined,
  };

  const parsed = UpdateProgramItemSchema.parse(raw);

  const item = await db.programItem.findUniqueOrThrow({
    where: { id: parsed.itemId },
  });

  await requireCaptain(item.tripId);

  const data: Record<string, unknown> = {};
  if (parsed.date) data.date = new Date(parsed.date + "T00:00:00Z");
  if (parsed.time !== undefined) data.time = parsed.time || null;
  if (parsed.title) data.title = parsed.title;
  if (parsed.notes !== undefined) data.notes = parsed.notes || null;
  if (parsed.placeName !== undefined) data.placeName = parsed.placeName || null;
  if (parsed.url !== undefined) data.url = parsed.url || null;

  await db.programItem.update({
    where: { id: parsed.itemId },
    data,
  });

  revalidatePath(`/trips/${item.tripId}`);
}

export async function removeProgramItem(formData: FormData) {
  const itemId = formData.get("itemId") as string;

  const item = await db.programItem.findUniqueOrThrow({
    where: { id: itemId },
  });

  const { member } = await requireCaptain(item.tripId);

  await db.programItem.delete({ where: { id: itemId } });

  await db.activityLog.create({
    data: {
      id: createId(),
      actorId: member.id,
      type: "PROGRAM_ITEM_REMOVED",
      tripId: item.tripId,
      payloadJson: { title: item.title },
    },
  });

  revalidatePath(`/trips/${item.tripId}`);
}
