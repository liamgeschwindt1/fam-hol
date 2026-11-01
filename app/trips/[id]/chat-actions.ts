"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

const ALLOWED_EMOJIS = ["❤️", "😂", "👍", "🎉", "😮", "🙏"] as const;

const addCommentSchema = z.object({
  tripId: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  bodyMd: z.string().min(1).max(4000),
  parentId: z.string().optional(),
});

const editCommentSchema = z.object({
  commentId: z.string().min(1),
  bodyMd: z.string().min(1).max(4000),
});

const deleteCommentSchema = z.object({
  commentId: z.string().min(1),
});

const toggleReactionSchema = z.object({
  commentId: z.string().min(1),
  emoji: z.string().refine(
    (e) => (ALLOWED_EMOJIS as readonly string[]).includes(e),
    "Invalid emoji",
  ),
});

export async function addComment(
  tripId: string,
  targetType: string,
  targetId: string,
  bodyMd: string,
  parentId?: string,
) {
  const { member } = await requireMember();
  const input = addCommentSchema.parse({
    tripId,
    targetType,
    targetId,
    bodyMd,
    parentId,
  });

  // Verify trip access
  const trip = await db.trip.findUnique({
    where: { id: input.tripId },
    select: {
      familyId: true,
      family: {
        select: {
          members: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!trip || trip.familyId !== member.familyId) {
    throw new Error("Trip not found");
  }

  const commentId = createId();
  const members = trip.family.members;

  await db.comment.create({
    data: {
      id: commentId,
      tripId: input.tripId,
      targetType: input.targetType,
      targetId: input.targetId,
      parentId: input.parentId ?? null,
      authorId: member.id,
      bodyMd: input.bodyMd,
    },
  });

  // Extract @mentions — match @Name against family member names
  const mentionedMembers = members.filter(
    (m) =>
      m.id !== member.id &&
      input.bodyMd.includes(`@${m.name}`),
  );

  // Create Mention rows and notifications for mentioned members
  for (const mentioned of mentionedMembers) {
    await db.mention.create({
      data: {
        commentId,
        memberId: mentioned.id,
      },
    });

    await createNotification(mentioned.id, "MENTION", {
      tripId: input.tripId,
      commentId,
      authorName: member.name,
      excerpt: input.bodyMd.slice(0, 120),
    });
  }

  // If this is a reply, notify the parent comment author
  if (input.parentId) {
    const parent = await db.comment.findUnique({
      where: { id: input.parentId },
      select: { authorId: true },
    });

    if (parent && parent.authorId !== member.id) {
      // Don't duplicate if they were already mentioned
      const alreadyNotified = mentionedMembers.some(
        (m) => m.id === parent.authorId,
      );
      if (!alreadyNotified) {
        await createNotification(parent.authorId, "REPLY", {
          tripId: input.tripId,
          commentId,
          authorName: member.name,
          excerpt: input.bodyMd.slice(0, 120),
        });
      }
    }
  }

  await logActivity(member.id, "COMMENT_ADDED", input.tripId, {
    commentId,
    targetType: input.targetType,
    targetId: input.targetId,
  });

  return { commentId };
}

export async function editComment(commentId: string, bodyMd: string) {
  const { member } = await requireMember();
  const input = editCommentSchema.parse({ commentId, bodyMd });

  const comment = await db.comment.findUnique({
    where: { id: input.commentId },
    select: { authorId: true },
  });

  if (!comment || comment.authorId !== member.id) {
    throw new Error("Not authorised");
  }

  await db.comment.update({
    where: { id: input.commentId },
    data: {
      bodyMd: input.bodyMd,
      editedAt: new Date(),
    },
  });
}

export async function deleteComment(commentId: string) {
  const { member } = await requireMember();
  const input = deleteCommentSchema.parse({ commentId });

  const comment = await db.comment.findUnique({
    where: { id: input.commentId },
    select: { authorId: true },
  });

  if (!comment || comment.authorId !== member.id) {
    throw new Error("Not authorised");
  }

  await db.comment.update({
    where: { id: input.commentId },
    data: { deletedAt: new Date() },
  });
}

export async function toggleReaction(commentId: string, emoji: string) {
  const { member } = await requireMember();
  const input = toggleReactionSchema.parse({ commentId, emoji });

  const existing = await db.reaction.findUnique({
    where: {
      commentId_memberId_emoji: {
        commentId: input.commentId,
        memberId: member.id,
        emoji: input.emoji,
      },
    },
  });

  if (existing) {
    await db.reaction.delete({
      where: {
        commentId_memberId_emoji: {
          commentId: input.commentId,
          memberId: member.id,
          emoji: input.emoji,
        },
      },
    });
  } else {
    await db.reaction.create({
      data: {
        commentId: input.commentId,
        memberId: member.id,
        emoji: input.emoji,
      },
    });
  }
}
