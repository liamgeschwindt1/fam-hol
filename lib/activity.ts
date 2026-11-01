import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@prisma/client";

export async function logActivity(
  actorId: string,
  type: string,
  tripId?: string,
  payload?: Record<string, unknown>,
) {
  await db.activityLog.create({
    data: {
      id: createId(),
      actorId,
      type,
      tripId: tripId ?? null,
      payloadJson: (payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}
