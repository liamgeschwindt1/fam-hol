"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createId } from "@paralleldrive/cuid2";

export type LoginState = {
  error?: string;
  needsApproval?: boolean;
  memberId?: string;
};

export async function loginWithPin(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const memberId = formData.get("memberId");
  const pin = formData.get("pin");

  if (typeof memberId !== "string" || typeof pin !== "string") {
    return { error: "Invalid request." };
  }

  // Rate limit per member
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(`pin:${memberId}:${ip}`, 5, 15 * 60 * 1000)) {
    return { error: "Too many attempts. Please wait 15 minutes." };
  }

  const member = await db.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    return { error: "Member not found." };
  }

  if (!member.pinHash) {
    // Should not be called without PIN, but handle gracefully
    return { error: "No PIN set for this member." };
  }

  const submittedHash = hashToken(pin);
  if (submittedHash !== member.pinHash) {
    return { error: "Incorrect PIN. Try again." };
  }

  const userAgent = headerStore.get("user-agent") ?? undefined;
  const rawToken = await createSession(member.id, userAgent);
  await setSessionCookie(rawToken);

  redirect("/");
}

export async function requestAdminApproval(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const memberId = formData.get("memberId");

  if (typeof memberId !== "string") {
    return { error: "Invalid request." };
  }

  const member = await db.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    return { error: "Member not found." };
  }

  // Create a DeviceRequest
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Rate limit device requests too
  if (!checkRateLimit(`device-req:${memberId}:${ip}`, 3, 15 * 60 * 1000)) {
    return { error: "Too many requests. Please wait 15 minutes." };
  }

  // Generate a token for this device request (admin will use this to approve)
  const rawToken = (await import("crypto")).default.randomBytes(16).toString("hex");
  const tokenHash = hashToken(rawToken);

  await db.deviceRequest.create({
    data: {
      id: createId(),
      memberId: member.id,
      status: "PENDING",
      tokenHash,
    },
  });

  return { needsApproval: true, memberId: member.id };
}
