"use client";

import { useState, useEffect, useCallback } from "react";
import { CommentThread } from "@/components/CommentThread";
import type { CommentData } from "@/components/CommentThread";
import { CommentForm } from "@/components/CommentForm";
import {
  addComment,
  editComment,
  deleteComment,
  toggleReaction,
} from "./chat-actions";

interface MemberOption {
  id: string;
  name: string;
  photoKey: string | null;
}

interface ChatTabProps {
  tripId: string;
  currentMemberId: string;
  initialComments: CommentData[];
  members: MemberOption[];
}

export function ChatTab({
  tripId,
  currentMemberId,
  initialComments,
  members,
}: ChatTabProps) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);

  // Auto-refresh every 30s
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/trips/${tripId}/comments`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as CommentData[];
        setComments(data);
      }
    } catch {
      // Silently fail on refresh
    }
  }, [tripId]);

  useEffect(() => {
    const interval = setInterval(() => void fetchComments(), 30_000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const handleAddComment = async (body: string) => {
    await addComment(tripId, "TRIP", tripId, body);
    await fetchComments();
  };

  const handleReply = async (parentId: string, body: string) => {
    await addComment(tripId, "TRIP", tripId, body, parentId);
    await fetchComments();
  };

  const handleEdit = async (commentId: string, body: string) => {
    await editComment(commentId, body);
    await fetchComments();
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
    await fetchComments();
  };

  const handleReact = async (commentId: string, emoji: string) => {
    await toggleReaction(commentId, emoji);
    await fetchComments();
  };

  return (
    <div>
      <CommentForm
        onSubmit={handleAddComment}
        members={members}
        placeholder="Say something about this trip..."
      />

      <div style={{ marginTop: "var(--space-6)" }}>
        <CommentThread
          comments={comments}
          currentMemberId={currentMemberId}
          members={members}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReact={handleReact}
        />
      </div>
    </div>
  );
}
