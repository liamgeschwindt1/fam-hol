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
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

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

export type InviteEmailState = { error?: string; success?: string };

export async function inviteByEmail(
  _previous: InviteEmailState,
  formData: FormData,
): Promise<InviteEmailState> {
  const parsed = z.string().email().max(254).safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };

  const { family, member } = await requireMember();
  const email = parsed.data.trim().toLowerCase();
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`group-invite:${family.id}:${member.id}:${ip}`, 5, 15 * 60 * 1000)) {
    return { error: "Too many invitations sent. Please wait 15 minutes." };
  }
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const inviteUrl = new URL(`/join/${rawToken}`, process.env.APP_URL ?? "http://localhost:3000").toString();
  const invite = await db.groupInvitation.create({
    data: {
      id: createId(),
      familyId: family.id,
      email,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  try {
    const safeGroupName = family.name.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]!);
    await sendEmail({
      to: email,
      subject: `You're invited to join ${family.name}`,
      text: `You've been invited to join ${family.name}. Create your group profile here: ${inviteUrl}`,
      html: `<p>You've been invited to join <strong>${safeGroupName}</strong>.</p><p><a href="${inviteUrl}">Accept the invitation</a></p><p>This link expires in seven days.</p>`,
    });
  } catch (error) {
    await db.groupInvitation.delete({ where: { id: invite.id } });
    console.error("Group invitation email failed", { familyId: family.id, error });
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not send the invitation email.",
    };
  }

  return { success: `Invitation sent to ${email}.` };
}

export async function createGroupInviteLink(): Promise<string> {
  const { family } = await requireMember();
  const rawToken = crypto.randomBytes(32).toString("base64url");
  await db.family.update({
    where: { id: family.id },
    data: { inviteTokenHash: hashToken(rawToken) },
  });
  return new URL(
    `/join/${rawToken}`,
    process.env.APP_URL ?? "http://localhost:3000",
  ).toString();
}
