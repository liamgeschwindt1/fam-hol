"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireMember, hashToken } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

// ─── Helper: require admin ────────────────────────────────────────────────────

async function requireAdmin() {
  const { member, family } = await requireMember();
  if (!member.isAdmin) {
    redirect("/");
  }
  return { member, family };
}

// ─── Invite token regeneration ────────────────────────────────────────────────

export async function regenerateInviteToken(): Promise<void> {
  const { family } = await requireAdmin();

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const inviteTokenHash = hashToken(rawToken);

  await db.family.update({
    where: { id: family.id },
    data: { inviteTokenHash },
  });

  redirect("/admin");
}

// ─── Toggle admin ─────────────────────────────────────────────────────────────

export async function toggleAdmin(memberId: string): Promise<void> {
  const { member: actor, family } = await requireAdmin();

  if (memberId === actor.id) {
    // Can't demote yourself
    return;
  }

  const target = await db.member.findFirst({
    where: { id: memberId, familyId: family.id },
  });

  if (!target) return;

  await db.member.update({
    where: { id: memberId },
    data: { isAdmin: !target.isAdmin },
  });

  redirect("/admin");
}

// ─── Remove member ────────────────────────────────────────────────────────────

export async function removeMember(memberId: string): Promise<void> {
  const { member: actor, family } = await requireAdmin();

  if (memberId === actor.id) {
    // Can't remove yourself
    return;
  }

  await db.member.deleteMany({
    where: { id: memberId, familyId: family.id },
  });

  redirect("/admin");
}

// ─── Approve device request ───────────────────────────────────────────────────

export async function approveDeviceRequest(requestId: string): Promise<void> {
  const { family } = await requireAdmin();

  const request = await db.deviceRequest.findFirst({
    where: { id: requestId, status: "PENDING" },
    include: { member: true },
  });

  if (!request || request.member.familyId !== family.id) return;

  // Create a session for the member
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);

  await db.$transaction([
    db.session.create({
      data: {
        id: createId(),
        memberId: request.member.id,
        tokenHash,
        expiresAt,
      },
    }),
    db.deviceRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", tokenHash },
    }),
  ]);

  redirect("/admin");
}

// ─── Reject device request ────────────────────────────────────────────────────

export async function rejectDeviceRequest(requestId: string): Promise<void> {
  const { family } = await requireAdmin();

  const request = await db.deviceRequest.findFirst({
    where: { id: requestId },
    include: { member: true },
  });

  if (!request || request.member.familyId !== family.id) return;

  await db.deviceRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" },
  });

  redirect("/admin");
}
