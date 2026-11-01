"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import {
  getCurrentSession,
  hashToken,
  createSession,
  setSessionCookie,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const JoinSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email address").max(254),
  photoKey: z.string().optional(),
  householdId: z.string().optional(),
  newHouseholdName: z.string().max(80).optional(),
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits").optional(),
});

export type JoinState = {
  errors?: Record<string, string[]>;
  message?: string;
};

export async function joinFamily(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  // Rate limit by IP
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(`join:${ip}`, 5, 15 * 60 * 1000)) {
    return { message: "Too many attempts. Please try again in 15 minutes." };
  }

  const raw = {
    token: formData.get("token"),
    name: formData.get("name"),
    email: formData.get("email"),
    photoKey: formData.get("photoKey") ?? undefined,
    householdId: formData.get("householdId") ?? undefined,
    newHouseholdName: formData.get("newHouseholdName") ?? undefined,
    pin: formData.get("pin") ?? undefined,
  };

  const parsed = JoinSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { token, name, email, photoKey, householdId, newHouseholdName, pin } =
    parsed.data;

  // Validate invite token
  const tokenHash = hashToken(token);
  const linkFamily = await db.family.findFirst({
    where: { inviteTokenHash: tokenHash },
  });
  const invitation = await db.groupInvitation.findUnique({
    where: { tokenHash },
  });
  const validInvitation =
    invitation && !invitation.acceptedAt && invitation.expiresAt > new Date()
      ? invitation
      : null;
  const family =
    validInvitation
      ? await db.family.findUnique({ where: { id: validInvitation.familyId } })
      : linkFamily;

  if (!family) {
    return { message: "Invalid or expired invite link." };
  }
  const normalizedEmail = email.toLowerCase();
  if (
    validInvitation?.email &&
    normalizedEmail !== validInvitation.email.toLowerCase()
  ) {
    return { errors: { email: ["Use the email address this invitation was sent to."] } };
  }

  const currentSession = await getCurrentSession();
  const activeMember = currentSession?.member ?? null;
  let account = activeMember?.userAccount ?? null;
  if (account && account.email !== normalizedEmail) {
    return { errors: { email: ["This session is linked to a different email account."] } };
  }

  if (!account) {
    if (!pin) {
      return { errors: { pin: ["Choose a 4–8 digit PIN for your account."] } };
    }
    account = await db.userAccount.findUnique({
      where: { email: normalizedEmail },
    });
    if (account && hashToken(pin) !== account.pinHash) {
      return { errors: { pin: ["That email already has an account. Enter its PIN to join."] } };
    }
    if (!account) {
      account = await db.userAccount.create({
        data: {
          id: createId(),
          email: normalizedEmail,
          pinHash: hashToken(pin),
        },
      });
    }
  }

  if (activeMember && !activeMember.userAccountId) {
    await db.member.update({
      where: { id: activeMember.id },
      data: { userAccountId: account.id },
    });
  }

  // Resolve or create household
  let resolvedHouseholdId: string | null = null;

  if (householdId && householdId !== "new") {
    // Verify it belongs to this family
    const hh = await db.household.findFirst({
      where: { id: householdId, familyId: family.id },
    });
    if (hh) resolvedHouseholdId = hh.id;
  } else if (householdId === "new" && newHouseholdName?.trim()) {
    const newHH = await db.household.create({
      data: {
        id: createId(),
        familyId: family.id,
        name: newHouseholdName.trim(),
      },
    });
    resolvedHouseholdId = newHH.id;
  }

  // Calendar token
  const calendarToken = crypto.randomBytes(16).toString("hex");

  let member = await db.member.findFirst({
    where: { familyId: family.id, userAccountId: account.id, isDependent: false },
  });
  if (!member && activeMember?.familyId === family.id) {
    member = await db.member.update({
      where: { id: activeMember.id },
      data: {
        userAccountId: account.id,
        householdId: resolvedHouseholdId,
        name,
        photoKey: photoKey ?? activeMember.photoKey,
      },
    });
  }
  if (!member) {
    member = await db.member.create({
      data: {
        id: createId(),
        familyId: family.id,
        userAccountId: account.id,
        householdId: resolvedHouseholdId,
        name,
        photoKey: photoKey ?? null,
        isAdmin: false,
        isDependent: false,
        calendarToken,
      },
    });
  }

  if (validInvitation) {
    await db.groupInvitation.update({
      where: { id: validInvitation.id },
      data: { acceptedAt: new Date() },
    });
  }

  // Create session
  const rawToken = await createSession(member.id, undefined);
  await setSessionCookie(rawToken);

  redirect("/");
}
