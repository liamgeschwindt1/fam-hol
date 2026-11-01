"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import {
  getCurrentSession,
  hashToken,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

const SetupSchema = z.object({
  familyName: z.string().trim().min(1, "Family name is required").max(80),
  adminName: z.string().trim().min(1, "Your name is required").max(80),
  email: z.string().trim().email("Enter a valid email address").max(254),
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits"),
  homeCurrency: z.string().length(3).default("GBP"),
  secondCurrency: z.string().length(3).optional(),
  photoKey: z.string().optional(),
});

export type SetupState = {
  errors?: Record<string, string[]>;
  message?: string;
};

export async function setupFamily(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const session = await getCurrentSession();
  if (session) {
    redirect(session.member.userAccountId ? "/groups/new" : "/me");
  }

  const raw = {
    familyName: formData.get("familyName"),
    adminName: formData.get("adminName"),
    email: formData.get("email"),
    pin: formData.get("pin"),
    homeCurrency: formData.get("homeCurrency") ?? "GBP",
    secondCurrency: formData.get("secondCurrency") || undefined,
    photoKey: formData.get("photoKey") || undefined,
  };

  const parsed = SetupSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const {
    familyName,
    adminName,
    email,
    pin,
    homeCurrency,
    secondCurrency,
    photoKey,
  } = parsed.data;

  const normalizedEmail = email.toLowerCase();
  if (await db.userAccount.findUnique({ where: { email: normalizedEmail } })) {
    return { errors: { email: ["An account already uses this email. Sign in instead."] } };
  }

  // Generate invite token
  const rawInviteToken = crypto.randomBytes(32).toString("base64url");
  const inviteTokenHash = hashToken(rawInviteToken);

  // Generate calendar token for admin member
  const calendarToken = crypto.randomBytes(16).toString("hex");

  // Create family + admin member in a transaction
  const familyId = createId();
  const memberId = createId();
  const userAccountId = createId();

  await db.$transaction([
    db.userAccount.create({
      data: {
        id: userAccountId,
        email: normalizedEmail,
        pinHash: hashToken(pin),
      },
    }),
    db.family.create({
      data: {
        id: familyId,
        name: familyName,
        inviteTokenHash,
        homeCurrency,
        secondCurrency: secondCurrency ?? null,
      },
    }),
    db.member.create({
      data: {
        id: memberId,
        familyId,
        userAccountId,
        name: adminName,
        photoKey: photoKey ?? null,
        isAdmin: true,
        isDependent: false,
        calendarToken,
      },
    }),
  ]);

  // Create session
  const rawToken = await createSession(memberId, undefined);
  await setSessionCookie(rawToken);

  redirect("/");
}
