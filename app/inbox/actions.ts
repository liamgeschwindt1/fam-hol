"use server";

import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { z } from "zod";

const markReadSchema = z.object({
  notificationId: z.string().min(1),
});

export async function markNotificationRead(notificationId: string) {
  const { member } = await requireMember();
  const input = markReadSchema.parse({ notificationId });

  const notification = await db.notification.findUnique({
    where: { id: input.notificationId },
    select: { memberId: true },
  });

  if (!notification || notification.memberId !== member.id) {
    throw new Error("Not found");
  }

  await db.notification.update({
    where: { id: input.notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead() {
  const { member } = await requireMember();

  await db.notification.updateMany({
    where: {
      memberId: member.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}
