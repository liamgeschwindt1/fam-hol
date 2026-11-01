"use server";

import { revalidatePath } from "next/cache";
import { requireMember, hashToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import { logActivity } from "@/lib/activity";
import { z } from "zod";

export async function setCalendarCostVisibility(visible: boolean) {
  const value = z.boolean().parse(visible);
  const { member, family } = await requireMember();
  await db.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: member.id, familyId: family.id },
      data: { calendarShowCosts: value, calendarRevision: { increment: 1 } },
    });
    await tx.activityLog.create({
      data: {
        id: createId(),
        actorId: member.id,
        type: "CALENDAR_COST_VISIBILITY",
        payloadJson: { visible: value },
      },
    });
  });
  revalidatePath("/me");
}

export async function updateProfile(name: string) {
  const { member } = await requireMember();

  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) {
    throw new Error("Name must be between 1 and 100 characters.");
  }

  await db.member.update({
    where: { id: member.id },
    data: { name: trimmed },
  });

  await logActivity(member.id, "PROFILE_UPDATE", undefined, {
    field: "name",
  });

  revalidatePath("/me");
}

export async function changePin(oldPin: string, newPin: string) {
  const { member } = await requireMember();

  // Validate old PIN
  if (member.pinHash) {
    const oldHash = hashToken(oldPin);
    if (oldHash !== member.pinHash) {
      throw new Error("Current PIN is incorrect.");
    }
  }

  // Validate new PIN
  if (!newPin || newPin.length < 4 || newPin.length > 8) {
    throw new Error("New PIN must be 4-8 characters.");
  }

  const newHash = hashToken(newPin);

  await db.member.update({
    where: { id: member.id },
    data: { pinHash: newHash },
  });

  await logActivity(member.id, "PIN_CHANGED");

  revalidatePath("/me");
}

export async function regenerateCalendarToken() {
  const { member } = await requireMember();

  const newToken = createId();

  await db.member.update({
    where: { id: member.id },
    data: { calendarToken: newToken },
  });

  await logActivity(member.id, "CALENDAR_TOKEN_REGENERATED");

  revalidatePath("/me");
}
