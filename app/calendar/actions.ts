"use server";

import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";

export async function regenerateCalendarToken(): Promise<string> {
  const { member } = await requireMember();

  const newToken = createId();

  await db.member.update({
    where: { id: member.id },
    data: { calendarToken: newToken },
  });

  return newToken;
}
