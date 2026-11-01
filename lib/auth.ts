import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";

const COOKIE_NAME = "ft_session";
const SESSION_DAYS = 400;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

// ─── Token hashing ────────────────────────────────────────────────────────────

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ─── Session creation ─────────────────────────────────────────────────────────

export async function createSession(
  memberId: string,
  userAgent?: string,
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MS);

  await db.session.create({
    data: {
      id: createId(),
      memberId,
      tokenHash,
      expiresAt,
      userAgent: userAgent ?? null,
    },
  });

  return rawToken;
}

// ─── Session reading ──────────────────────────────────────────────────────────

export async function getSession(request: Request): Promise<{
  member: {
    id: string;
    name: string;
    photoKey: string | null;
    isAdmin: boolean;
    isDependent: boolean;
    familyId: string;
    householdId: string | null;
    pinHash: string | null;
    calendarToken: string;
  };
  family: {
    id: string;
    name: string;
    homeCurrency: string;
    secondCurrency: string | null;
    inviteTokenHash: string;
  };
} | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match?.[1]) return null;

  const rawToken = decodeURIComponent(match[1]);
  const tokenHash = hashToken(rawToken);

  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      member: {
        include: { family: true },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  // Rolling refresh — extend by another SESSION_MS
  await db.session
    .update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_MS) },
    })
    .catch(() => null);

  return {
    member: {
      id: session.member.id,
      name: session.member.name,
      photoKey: session.member.photoKey,
      isAdmin: session.member.isAdmin,
      isDependent: session.member.isDependent,
      familyId: session.member.familyId,
      householdId: session.member.householdId,
      pinHash: session.member.pinHash,
      calendarToken: session.member.calendarToken,
    },
    family: {
      id: session.member.family.id,
      name: session.member.family.name,
      homeCurrency: session.member.family.homeCurrency,
      secondCurrency: session.member.family.secondCurrency,
      inviteTokenHash: session.member.family.inviteTokenHash,
    },
  };
}

// ─── requireMember ────────────────────────────────────────────────────────────

export async function requireMember() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!rawToken) {
    redirect("/welcome-back");
  }

  const tokenHash = hashToken(rawToken);

  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      member: {
        include: { family: true },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    redirect("/welcome-back");
  }

  // Rolling refresh
  await db.session
    .update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_MS) },
    })
    .catch(() => null);

  return {
    member: session.member,
    family: session.member.family,
  };
}

// ─── Cookie setter ────────────────────────────────────────────────────────────

export function buildSessionCookieHeader(rawToken: string): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    `Max-Age=${maxAge}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

// ─── Cookie deleter ───────────────────────────────────────────────────────────

export function buildClearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

// ─── Set cookie via next/headers (for server actions) ─────────────────────────

export async function setSessionCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  cookieStore.set(COOKIE_NAME, rawToken, {
    maxAge,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
}

export { COOKIE_NAME };
