import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@prisma/client";

export async function createNotification(
  memberId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  await db.notification.create({
    data: {
      id: createId(),
      memberId,
      type,
      payloadJson: payload as Prisma.InputJsonValue,
    },
  });
}

export async function getUnreadCount(memberId: string): Promise<number> {
  return db.notification.count({
    where: {
      memberId,
      readAt: null,
    },
  });
}
