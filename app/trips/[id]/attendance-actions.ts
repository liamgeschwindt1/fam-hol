"use server";

import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { AttendStatus } from "@prisma/client";

export async function updateAttendance(
  tripId: string,
  targetMemberId: string,
  dateStr: string,
  status: AttendStatus | null,
) {
  const { member, family } = await requireMember();

  // Verify trip belongs to family
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
  });
  if (trip.familyId !== family.id) {
    throw new Error("Access denied");
  }

  // Can edit own attendance, or dependents you are guardian of
  if (targetMemberId !== member.id) {
    const target = await db.member.findUniqueOrThrow({
      where: { id: targetMemberId },
    });
    if (!target.isDependent || target.guardianId !== member.id) {
      throw new Error("You can only edit your own attendance or your dependents'");
    }
  }

  const date = new Date(dateStr + "T00:00:00Z");

  if (status === null) {
    // Remove attendance
    await db.attendance.deleteMany({
      where: { tripId, memberId: targetMemberId, date },
    });
  } else {
    await db.attendance.upsert({
      where: {
        tripId_memberId_date: { tripId, memberId: targetMemberId, date },
      },
      create: {
        tripId,
        memberId: targetMemberId,
        date,
        status,
      },
      update: { status },
    });
  }

  revalidatePath(`/trips/${tripId}`);
}

export async function bulkUpdateAttendance(
  tripId: string,
  targetMemberId: string,
  dateStrings: string[],
  status: AttendStatus | null,
) {
  const { member, family } = await requireMember();

  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
  });
  if (trip.familyId !== family.id) {
    throw new Error("Access denied");
  }

  if (targetMemberId !== member.id) {
    const target = await db.member.findUniqueOrThrow({
      where: { id: targetMemberId },
    });
    if (!target.isDependent || target.guardianId !== member.id) {
      throw new Error("You can only edit your own attendance or your dependents'");
    }
  }

  if (status === null) {
    // Remove all attendance for these dates
    const dates = dateStrings.map((d) => new Date(d + "T00:00:00Z"));
    await db.attendance.deleteMany({
      where: {
        tripId,
        memberId: targetMemberId,
        date: { in: dates },
      },
    });
  } else {
    // Upsert each date
    await db.$transaction(
      dateStrings.map((d) => {
        const date = new Date(d + "T00:00:00Z");
        return db.attendance.upsert({
          where: {
            tripId_memberId_date: { tripId, memberId: targetMemberId, date },
          },
          create: { tripId, memberId: targetMemberId, date, status },
          update: { status },
        });
      }),
    );
  }

  revalidatePath(`/trips/${tripId}`);
}
