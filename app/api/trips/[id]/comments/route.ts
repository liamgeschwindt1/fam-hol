import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { CommentData } from "@/components/CommentThread";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json([], { status: 401 });
  }

  const { id: tripId } = await params;

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { familyId: true },
  });

  if (!trip || trip.familyId !== session.family.id) {
    return NextResponse.json([], { status: 404 });
  }

  const rawComments = await db.comment.findMany({
    where: {
      tripId,
      targetType: "TRIP",
      targetId: tripId,
      parentId: null,
    },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, photoKey: true } },
      reactions: {
        include: { member: { select: { name: true } } },
      },
    },
  });

  // Fetch replies
  const commentIds = rawComments.map((c) => c.id);
  const rawReplies = await db.comment.findMany({
    where: {
      parentId: { in: commentIds },
    },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, photoKey: true } },
      reactions: {
        include: { member: { select: { name: true } } },
      },
    },
  });

  const repliesByParent = new Map<string, typeof rawReplies>();
  for (const reply of rawReplies) {
    const parentId = reply.parentId!;
    const existing = repliesByParent.get(parentId) ?? [];
    existing.push(reply);
    repliesByParent.set(parentId, existing);
  }

  function mapComment(
    c: (typeof rawComments)[number],
    replies: typeof rawReplies,
  ): CommentData {
    // Aggregate reactions
    const reactionMap = new Map<
      string,
      { count: number; memberNames: string[]; reacted: boolean }
    >();
    for (const r of c.reactions) {
      const existing = reactionMap.get(r.emoji) ?? {
        count: 0,
        memberNames: [],
        reacted: false,
      };
      existing.count++;
      existing.memberNames.push(r.member.name);
      if (r.memberId === session!.member.id) existing.reacted = true;
      reactionMap.set(r.emoji, existing);
    }

    return {
      id: c.id,
      authorId: c.author.id,
      authorName: c.author.name,
      authorPhotoKey: c.author.photoKey,
      bodyMd: c.bodyMd,
      createdAt: c.createdAt.toISOString(),
      editedAt: c.editedAt?.toISOString() ?? null,
      deletedAt: c.deletedAt?.toISOString() ?? null,
      reactions: Array.from(reactionMap.entries()).map(
        ([emoji, data]) => ({
          emoji,
          ...data,
        }),
      ),
      replies: replies.map((r) => mapComment(r, [])),
    };
  }

  const comments: CommentData[] = rawComments.map((c) =>
    mapComment(c, repliesByParent.get(c.id) ?? []),
  );

  return NextResponse.json(comments);
}
