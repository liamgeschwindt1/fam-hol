"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import type { ChangeType, Prisma } from "@prisma/client";

interface ChangeInput {
  type: ChangeType;
  targetId?: string;
  beforeJson?: unknown;
  afterJson: unknown;
}

export async function createProposal(
  tripId: string,
  title: string,
  descriptionMd: string | null,
  changes: ChangeInput[],
) {
  const { member, family } = await requireMember();

  if (!title.trim()) throw new Error("Title is required");
  if (changes.length === 0) throw new Error("No changes to propose");

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyId !== family.id) throw new Error("Trip not found");

  const proposalId = createId();

  await db.$transaction(async (tx) => {
    await tx.proposal.create({
      data: {
        id: proposalId,
        tripId,
        authorId: member.id,
        title: title.trim(),
        descriptionMd: descriptionMd?.trim() || null,
        baseRevision: trip.revision,
        status: "OPEN",
        changes: {
          create: changes.map((c) => ({
            id: createId(),
            type: c.type,
            targetId: c.targetId ?? null,
            beforeJson: (c.beforeJson ?? null) as Prisma.InputJsonValue,
            afterJson: c.afterJson as Prisma.InputJsonValue,
            state: "PENDING",
          })),
        },
      },
    });

    await tx.activityLog.create({
      data: {
        id: createId(),
        actorId: member.id,
        type: "PROPOSAL_OPENED",
        tripId,
        payloadJson: {
          proposalId,
          title: title.trim(),
          changeCount: changes.length,
        } as Prisma.InputJsonValue,
      },
    });
  });

  // Notify captain
  if (trip.captainId !== member.id) {
    await createNotification(trip.captainId, "PROPOSAL_OPENED", {
      tripId,
      proposalId,
      proposalTitle: title.trim(),
      authorName: member.name,
    });
  }

  await logActivity(member.id, "PROPOSAL_OPENED", tripId, {
    proposalId,
    title: title.trim(),
  });

  revalidatePath(`/trips/${tripId}`);
  return { proposalId };
}

export async function withdrawProposal(proposalId: string) {
  const { member } = await requireMember();

  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.authorId !== member.id) {
    throw new Error("Only the author can withdraw a proposal");
  }
  if (proposal.status !== "OPEN") {
    throw new Error("Only open proposals can be withdrawn");
  }

  await db.proposal.update({
    where: { id: proposalId },
    data: { status: "WITHDRAWN" },
  });

  await logActivity(member.id, "PROPOSAL_WITHDRAWN", proposal.tripId, {
    proposalId,
  });

  revalidatePath(`/trips/${proposal.tripId}`);
}
