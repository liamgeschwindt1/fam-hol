"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import { logActivity } from "@/lib/activity";
import type { Prisma } from "@prisma/client";

export async function restoreRevision(tripId: string, revisionId: string) {
  const { member, family } = await requireMember();

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyId !== family.id) throw new Error("Trip not found");
  if (trip.captainId !== member.id) {
    throw new Error("Only the captain can restore revisions");
  }

  const revision = await db.tripRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision || revision.tripId !== tripId) {
    throw new Error("Revision not found");
  }

  const snapshot = revision.snapshotJson as Record<string, unknown>;
  const newRevision = trip.revision + 1;

  // Build update data from snapshot — only restore safe fields
  const updateData: Record<string, unknown> = {};
  if (snapshot.title) updateData.title = snapshot.title;
  if (snapshot.tagline !== undefined) updateData.tagline = snapshot.tagline;
  if (snapshot.descriptionMd) updateData.descriptionMd = snapshot.descriptionMd;
  if (snapshot.season) updateData.season = snapshot.season;
  if (snapshot.startDate) {
    const dateStr = String(snapshot.startDate).split("T")[0];
    updateData.startDate = new Date(dateStr + "T00:00:00Z");
  }
  if (snapshot.endDate) {
    const dateStr = String(snapshot.endDate).split("T")[0];
    updateData.endDate = new Date(dateStr + "T00:00:00Z");
  }

  updateData.revision = newRevision;

  await db.$transaction(async (tx) => {
    await tx.trip.update({
      where: { id: tripId },
      data: updateData,
    });

    // Get fresh snapshot
    const updated = await tx.trip.findUniqueOrThrow({
      where: { id: tripId },
    });

    await tx.tripRevision.create({
      data: {
        id: createId(),
        tripId,
        revision: newRevision,
        snapshotJson: JSON.parse(
          JSON.stringify(updated),
        ) as Prisma.InputJsonValue,
        actorId: member.id,
        summary: `Restored from revision ${revision.revision}`,
      },
    });

    await tx.activityLog.create({
      data: {
        id: createId(),
        actorId: member.id,
        type: "REVISION_RESTORED",
        tripId,
        payloadJson: {
          fromRevision: revision.revision,
          toRevision: newRevision,
        } as Prisma.InputJsonValue,
      },
    });
  });

  await logActivity(member.id, "REVISION_RESTORED", tripId, {
    fromRevision: revision.revision,
    toRevision: newRevision,
  });

  revalidatePath(`/trips/${tripId}`);
}
