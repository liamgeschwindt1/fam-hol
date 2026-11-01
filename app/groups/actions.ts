"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { db } from "@/lib/db";
import { COOKIE_NAME, hashToken, setSessionCookie } from "@/lib/auth";
import { requireMember } from "@/lib/auth";

export async function switchGroup(formData: FormData) {
  const memberId = z.string().min(1).parse(formData.get("memberId"));
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken) redirect("/welcome-back");

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { member: true },
  });
  if (!session || session.expiresAt < new Date()) redirect("/welcome-back");
  if (!session.member.userAccountId) {
    throw new Error("Link an email account before switching groups.");
  }

  const target = await db.member.findFirst({
    where: {
      id: memberId,
      userAccountId: session.member.userAccountId,
      isDependent: false,
    },
    select: { id: true },
  });
  if (!target) throw new Error("That group is not linked to your account.");

  await db.session.update({
    where: { id: session.id },
    data: { memberId: target.id },
  });
  redirect("/");
}

export async function createGroup(formData: FormData) {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken) redirect("/welcome-back");

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { member: { include: { userAccount: true } } },
  });
  if (!session || session.expiresAt < new Date()) redirect("/welcome-back");

  const account = session.member.userAccount;
  if (!account) throw new Error("Link an email account before creating another group.");

  const parsed = z.object({
    groupName: z.string().trim().min(1).max(80),
    memberName: z.string().trim().min(1).max(80),
    homeCurrency: z.string().length(3),
  }).parse({
    groupName: formData.get("groupName"),
    memberName: formData.get("memberName"),
    homeCurrency: formData.get("homeCurrency"),
  });

  const familyId = createId();
  const memberId = createId();
  const calendarToken = crypto.randomBytes(16).toString("hex");
  const inviteTokenHash = hashToken(crypto.randomBytes(32).toString("base64url"));

  await db.$transaction([
    db.family.create({
      data: {
        id: familyId,
        name: parsed.groupName,
        inviteTokenHash,
        homeCurrency: parsed.homeCurrency,
      },
    }),
    db.member.create({
      data: {
        id: memberId,
        familyId,
        userAccountId: account.id,
        name: parsed.memberName,
        isAdmin: true,
        calendarToken,
      },
    }),
  ]);

  const nextToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(nextToken);
  const expiresAt = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      id: createId(),
      memberId,
      tokenHash,
      expiresAt,
      userAgent: session.userAgent,
    },
  });
  await setSessionCookie(nextToken);
  redirect("/");
}

export async function createGroupInviteLink(): Promise<string> {
  const { family } = await requireMember();
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const origin = process.env.APP_URL
    ?? (host ? `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${host}` : null);
  if (!origin) throw new Error("Set APP_URL to create group invitation links.");
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const inviteUrl = new URL(`/join/${rawToken}`, origin).toString();
  await db.groupInvitation.create({
    data: {
      id: createId(),
      familyId: family.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return inviteUrl;
}
