"use server";

import { revalidatePath } from "next/cache";
import { requireMember, hashToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import { logActivity } from "@/lib/activity";
import { z } from "zod";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const account = member.userAccountId
    ? await db.userAccount.findUniqueOrThrow({
        where: { id: member.userAccountId },
      })
    : null;

  // Validate old PIN
  const currentPinHash = account?.pinHash ?? member.pinHash;
  if (currentPinHash) {
    const oldHash = hashToken(oldPin);
    if (oldHash !== currentPinHash) {
      throw new Error("Current PIN is incorrect.");
    }
  }

  // Validate new PIN
  if (!/^\d{4,8}$/.test(newPin)) {
    throw new Error("New PIN must be 4–8 digits.");
  }

  const newHash = hashToken(newPin);

  if (account) {
    await db.userAccount.update({
      where: { id: account.id },
      data: { pinHash: newHash },
    });
  } else {
    await db.member.update({
      where: { id: member.id },
      data: { pinHash: newHash },
    });
  }

  await logActivity(member.id, "PIN_CHANGED");

  revalidatePath("/me");
}

export async function linkEmailAccount(email: string, pin: string) {
  const { member, family } = await requireMember();
  const normalizedEmail = z.string().email().max(254).parse(email.trim()).toLowerCase();
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error("PIN must be 4–8 digits.");
  }
  if (member.userAccountId) {
    throw new Error("This member is already linked to an email account.");
  }
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`link-account:${member.id}:${ip}`, 5, 15 * 60 * 1000)) {
    throw new Error("Too many account-link attempts. Please wait 15 minutes.");
  }

  let account = await db.userAccount.findUnique({
    where: { email: normalizedEmail },
  });
  const pinHash = hashToken(pin);
  if (account && account.pinHash !== pinHash) {
    throw new Error("That email already has an account. Enter its PIN to link it.");
  }
  if (!account) {
    account = await db.userAccount.create({
      data: {
        id: createId(),
        email: normalizedEmail,
        pinHash,
      },
    });
  }

  await db.member.update({
    where: { id: member.id, familyId: family.id },
    data: { userAccountId: account.id },
  });
  await logActivity(member.id, "EMAIL_ACCOUNT_LINKED");
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
