"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import type { Prisma } from "@prisma/client";

// ─── Merge proposal ─────────────────────────────────────────────

export async function mergeProposal(proposalId: string, changeIds: string[]) {
  const { member, family } = await requireMember();

  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    include: {
      trip: true,
      changes: true,
    },
  });

  if (!proposal) throw new Error("Proposal not found");
  if (proposal.trip.familyId !== family.id) throw new Error("Not found");
  if (proposal.trip.captainId !== member.id) {
    throw new Error("Only the captain can merge proposals");
  }
  if (proposal.status !== "OPEN") {
    throw new Error("Only open proposals can be merged");
  }

  const trip = proposal.trip;
  const newRevision = trip.revision + 1;

  await db.$transaction(async (tx) => {
    // Apply each selected change
    for (const change of proposal.changes) {
      const selected = changeIds.includes(change.id);

      if (!selected) {
        await tx.change.update({
          where: { id: change.id },
          data: { state: "SKIPPED" },
        });
        continue;
      }

      // Apply the change
      const after = change.afterJson as Record<string, unknown>;

      switch (change.type) {
        case "TRIP_FIELD_SET": {
          const field = after.field as string;
          const value = after.value;
          await tx.trip.update({
            where: { id: trip.id },
            data: { [field]: value },
          });
          break;
        }
        case "DATES_SET": {
          const startDate = after.startDate as string;
          const endDate = after.endDate as string;
          await tx.trip.update({
            where: { id: trip.id },
            data: {
              startDate: new Date(startDate + "T00:00:00Z"),
              endDate: new Date(endDate + "T00:00:00Z"),
            },
          });
          break;
        }
        case "PROGRAM_ITEM_ADD": {
          await tx.programItem.create({
            data: {
              id: createId(),
              tripId: trip.id,
              date: new Date(
                (after.date as string) + "T00:00:00Z",
              ),
              time: (after.time as string) ?? null,
              title: after.title as string,
              notes: (after.notes as string) ?? null,
              placeName: (after.placeName as string) ?? null,
              url: (after.url as string) ?? null,
              sort: (after.sort as number) ?? 0,
            },
          });
          break;
        }
        case "PROGRAM_ITEM_UPDATE": {
          if (!change.targetId) break;
          await tx.programItem.update({
            where: { id: change.targetId },
            data: {
              title: after.title as string,
              date: new Date(
                (after.date as string) + "T00:00:00Z",
              ),
              time: (after.time as string) ?? null,
              notes: (after.notes as string) ?? null,
              placeName: (after.placeName as string) ?? null,
              url: (after.url as string) ?? null,
            },
          });
          break;
        }
        case "PROGRAM_ITEM_REMOVE": {
          if (!change.targetId) break;
          await tx.programItem
            .delete({ where: { id: change.targetId } })
            .catch(() => null);
          break;
        }
        case "STAY_OPTION_ADD": {
          await tx.stayOption.create({
            data: {
              id: createId(),
              tripId: trip.id,
              title: after.title as string,
              url: after.url as string,
              priceNote: (after.priceNote as string) ?? null,
              rooms: (after.rooms as number) ?? null,
              capacity: (after.capacity as number) ?? null,
              pros: (after.pros as string) ?? null,
              cons: (after.cons as string) ?? null,
              addedById: proposal.authorId,
            },
          });
          break;
        }
        case "STAY_OPTION_UPDATE": {
          if (!change.targetId) break;
          await tx.stayOption.update({
            where: { id: change.targetId },
            data: {
              title: after.title as string,
              url: after.url as string,
              priceNote: (after.priceNote as string) ?? null,
              pros: (after.pros as string) ?? null,
              cons: (after.cons as string) ?? null,
            },
          });
          break;
        }
        case "STAY_OPTION_REMOVE": {
          if (!change.targetId) break;
          await tx.stayOption
            .delete({ where: { id: change.targetId } })
            .catch(() => null);
          break;
        }
        default:
          break;
      }

      await tx.change.update({
        where: { id: change.id },
        data: { state: "MERGED" },
      });
    }

    // Bump revision
    await tx.trip.update({
      where: { id: trip.id },
      data: { revision: newRevision },
    });

    // Create revision snapshot
    const updatedTrip = await tx.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });

    await tx.tripRevision.create({
      data: {
        id: createId(),
        tripId: trip.id,
        revision: newRevision,
        snapshotJson: JSON.parse(
          JSON.stringify(updatedTrip),
        ) as Prisma.InputJsonValue,
        actorId: member.id,
        summary: `Merged proposal: ${proposal.title}`,
        proposalId: proposal.id,
      },
    });

    // Mark proposal merged
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        status: "MERGED",
        mergedAt: new Date(),
        mergedById: member.id,
      },
    });

    // Activity log
    await tx.activityLog.create({
      data: {
        id: createId(),
        actorId: member.id,
        type: "PROPOSAL_MERGED",
        tripId: trip.id,
        payloadJson: {
          proposalId,
          title: proposal.title,
          mergedChanges: changeIds.length,
          totalChanges: proposal.changes.length,
        } as Prisma.InputJsonValue,
      },
    });
  });

  // Notify author
  if (proposal.authorId !== member.id) {
    await createNotification(proposal.authorId, "PROPOSAL_MERGED", {
      tripId: trip.id,
      proposalId,
      proposalTitle: proposal.title,
      mergedByName: member.name,
    });
  }

  await logActivity(member.id, "PROPOSAL_MERGED", trip.id, {
    proposalId,
    title: proposal.title,
  });

  revalidatePath(`/trips/${trip.id}`);
}

// ─── Reject proposal ────────────────────────────────────────────

export async function rejectProposal(proposalId: string, reason: string) {
  const { member, family } = await requireMember();

  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    include: { trip: true },
  });

  if (!proposal) throw new Error("Proposal not found");
  if (proposal.trip.familyId !== family.id) throw new Error("Not found");
  if (proposal.trip.captainId !== member.id) {
    throw new Error("Only the captain can reject proposals");
  }
  if (proposal.status !== "OPEN") {
    throw new Error("Only open proposals can be rejected");
  }

  await db.proposal.update({
    where: { id: proposalId },
    data: {
      status: "REJECTED",
      rejectReason: reason.trim() || null,
    },
  });

  if (proposal.authorId !== member.id) {
    await createNotification(proposal.authorId, "PROPOSAL_REJECTED", {
      tripId: proposal.tripId,
      proposalId,
      proposalTitle: proposal.title,
      reason: reason.trim(),
    });
  }

  await logActivity(member.id, "PROPOSAL_REJECTED", proposal.tripId, {
    proposalId,
    title: proposal.title,
  });

  revalidatePath(`/trips/${proposal.tripId}`);
}

// ─── Support proposal ───────────────────────────────────────────

export async function supportProposal(proposalId: string) {
  const { member, family } = await requireMember();

  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    include: { trip: true },
  });

  if (!proposal) throw new Error("Proposal not found");
  if (proposal.trip.familyId !== family.id) throw new Error("Not found");
  if (proposal.status !== "OPEN") throw new Error("Proposal is not open");

  const existing = await db.proposalSupport.findUnique({
    where: {
      proposalId_memberId: {
        proposalId,
        memberId: member.id,
      },
    },
  });

  if (existing) {
    await db.proposalSupport.delete({
      where: {
        proposalId_memberId: {
          proposalId,
          memberId: member.id,
        },
      },
    });
  } else {
    await db.proposalSupport.create({
      data: {
        proposalId,
        memberId: member.id,
      },
    });
  }

  revalidatePath(`/trips/${proposal.tripId}`);
}
