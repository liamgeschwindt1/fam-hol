"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { hashToken, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const JoinSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, "Name is required").max(80),
  photoKey: z.string().optional(),
  householdId: z.string().optional(),
  newHouseholdName: z.string().max(80).optional(),
  pin: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}$/.test(v), {
      message: "PIN must be exactly 4 digits",
    }),
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
    photoKey: formData.get("photoKey") ?? undefined,
    householdId: formData.get("householdId") ?? undefined,
    newHouseholdName: formData.get("newHouseholdName") ?? undefined,
    pin: formData.get("pin") ?? undefined,
  };

  const parsed = JoinSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { token, name, photoKey, householdId, newHouseholdName, pin } =
    parsed.data;

  // Validate invite token
  const tokenHash = hashToken(token);
  const family = await db.family.findFirst({
    where: { inviteTokenHash: tokenHash },
  });

  if (!family) {
    return { message: "Invalid or expired invite link." };
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

  // Hash PIN if provided
  const pinHash = pin ? hashToken(pin) : null;

  // Calendar token
  const calendarToken = crypto.randomBytes(16).toString("hex");

  const memberId = createId();
  await db.member.create({
    data: {
      id: memberId,
      familyId: family.id,
      householdId: resolvedHouseholdId,
      name,
      photoKey: photoKey ?? null,
      isAdmin: false,
      isDependent: false,
      pinHash,
      calendarToken,
    },
  });

  // Create session
  const rawToken = await createSession(memberId, undefined);
  await setSessionCookie(rawToken);

  redirect("/");
}
