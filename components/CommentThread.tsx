"use client";

import { useState } from "react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { CommentForm } from "@/components/CommentForm";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReactionData {
  emoji: string;
  count: number;
  memberNames: string[];
  reacted: boolean;
}

export interface CommentData {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoKey: string | null;
  bodyMd: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  reactions: ReactionData[];
  replies: CommentData[];
}

interface MemberOption {
  id: string;
  name: string;
  photoKey: string | null;
}

interface CommentThreadProps {
  comments: CommentData[];
  currentMemberId: string;
  members: MemberOption[];
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReact: (commentId: string, emoji: string) => Promise<void>;
}

const EMOJIS = ["❤️", "😂", "👍", "🎉", "😮", "🙏"] as const;

// ─── Inline markdown rendering ───────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(text: string): string {
  let result = escapeHtml(text);

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");

  // Links
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank" style="color:var(--sea)">$1</a>',
  );

  // @mentions — style as sea-colored
  result = result.replace(
    /@(\w[\w\s]*?\w)(?=\s|$|[.,!?])/g,
    '<span style="color:var(--sea);font-weight:500">@$1</span>',
  );

  return result;
}

// ─── Time formatting ─────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Single comment ──────────────────────────────────────────────────────────

function SingleComment({
  comment,
  currentMemberId,
  members,
  onReply,
  onEdit,
  onDelete,
  onReact,
  isReply,
}: {
  comment: CommentData;
  currentMemberId: string;
  members: MemberOption[];
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReact: (commentId: string, emoji: string) => Promise<void>;
  isReply: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const isOwn = comment.authorId === currentMemberId;
  const isDeleted = comment.deletedAt !== null;

  if (isDeleted) {
    return (
      <div
        style={{
          padding: "var(--space-3) 0",
          color: "var(--ink-soft)",
          fontStyle: "italic",
          fontSize: "var(--text-sm)",
          marginLeft: isReply ? "48px" : 0,
        }}
      >
        This comment was deleted.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "var(--space-3) 0",
        marginLeft: isReply ? "48px" : 0,
      }}
    >
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <MemberAvatar
          name={comment.authorName}
          photoKey={comment.authorPhotoKey}
          size={isReply ? 32 : 36}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--space-2)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                color: "var(--ink)",
              }}
            >
              {comment.authorName}
            </span>
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "11px",
                color: "var(--ink-soft)",
                letterSpacing: "0.08em",
              }}
            >
              {timeAgo(comment.createdAt)}
            </span>
            {comment.editedAt && (
              <span
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "11px",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.08em",
                }}
              >
                (edited)
              </span>
            )}
          </div>

          {/* Body */}
          {editing ? (
            <div style={{ marginTop: "var(--space-2)" }}>
              <CommentForm
                onSubmit={async (body) => {
                  await onEdit(comment.id, body);
                  setEditing(false);
                }}
                members={members}
                placeholder="Edit your comment..."
                initialValue={comment.bodyMd}
              />
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{
                  marginTop: "var(--space-1)",
                  background: "none",
                  border: "none",
                  color: "var(--ink-soft)",
                  fontSize: "var(--text-xs)",
                  cursor: "pointer",
                  fontFamily: "var(--font-hanken), system-ui, sans-serif",
                  padding: "var(--space-1)",
                  minHeight: "44px",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              style={{
                marginTop: "var(--space-1)",
                fontSize: "var(--text-sm)",
                lineHeight: 1.55,
                color: "var(--ink)",
              }}
              dangerouslySetInnerHTML={{
                __html: renderInlineMarkdown(comment.bodyMd),
              }}
            />
          )}

          {/* Reactions bar */}
          {!editing && comment.reactions.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-1)",
                marginTop: "var(--space-2)",
              }}
            >
              {comment.reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => void onReact(comment.id, r.emoji)}
                  title={r.memberNames.join(", ")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    border: r.reacted
                      ? "1px solid var(--sea)"
                      : "1px solid var(--rule)",
                    backgroundColor: r.reacted
                      ? "color-mix(in srgb, var(--sea) 10%, transparent)"
                      : "transparent",
                    cursor: "pointer",
                    fontSize: "14px",
                    minHeight: "28px",
                    fontFamily: "var(--font-hanken), system-ui, sans-serif",
                  }}
                >
                  <span>{r.emoji}</span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--ink-soft)",
                      fontWeight: 500,
                    }}
                  >
                    {r.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {!editing && (
            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                marginTop: "var(--space-2)",
              }}
            >
              {!isReply && (
                <ActionButton onClick={() => setReplyOpen(!replyOpen)}>
                  Reply
                </ActionButton>
              )}
              <ActionButton
                onClick={() => setShowReactions(!showReactions)}
              >
                React
              </ActionButton>
              {isOwn && (
                <>
                  <ActionButton onClick={() => setEditing(true)}>
                    Edit
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      if (window.confirm("Delete this comment?")) {
                        void onDelete(comment.id);
                      }
                    }}
                  >
                    Delete
                  </ActionButton>
                </>
              )}
            </div>
          )}

          {/* Emoji picker (inline) */}
          {showReactions && (
            <div
              style={{
                display: "flex",
                gap: "var(--space-1)",
                marginTop: "var(--space-2)",
                padding: "var(--space-2)",
                border: "1px solid var(--rule)",
                backgroundColor: "var(--bg)",
              }}
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    void onReact(comment.id, emoji);
                    setShowReactions(false);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "20px",
                    cursor: "pointer",
                    padding: "var(--space-1)",
                    minWidth: "36px",
                    minHeight: "36px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Inline reply form */}
          {replyOpen && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <CommentForm
                onSubmit={async (body) => {
                  await onReply(comment.id, body);
                  setReplyOpen(false);
                }}
                members={members}
                placeholder={`Reply to ${comment.authorName}...`}
              />
            </div>
          )}

          {/* Replies */}
          {comment.replies.map((reply) => (
            <SingleComment
              key={reply.id}
              comment={reply}
              currentMemberId={currentMemberId}
              members={members}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
              isReply
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Action button ───────────────────────────────────────────────────────────

function ActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: "var(--ink-soft)",
        fontSize: "12px",
        fontFamily: "var(--font-dm-mono), monospace",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        padding: "var(--space-1) var(--space-2)",
        minHeight: "44px",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </button>
  );
}

// ─── Thread ──────────────────────────────────────────────────────────────────

export function CommentThread({
  comments,
  currentMemberId,
  members,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-8) 0",
          textAlign: "center",
          color: "var(--ink-soft)",
          fontSize: "var(--text-sm)",
        }}
      >
        No comments yet. Start the conversation.
      </div>
    );
  }

  return (
    <div>
      {comments.map((comment) => (
        <div
          key={comment.id}
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <SingleComment
            comment={comment}
            currentMemberId={currentMemberId}
            members={members}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onReact={onReact}
            isReply={false}
          />
        </div>
      ))}
    </div>
  );
}
