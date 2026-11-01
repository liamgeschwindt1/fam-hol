"use client";

import { useRouter } from "next/navigation";
import { markNotificationRead, markAllRead } from "./actions";

interface NotificationItem {
  id: string;
  type: string;
  payloadJson: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

interface InboxListProps {
  notifications: NotificationItem[];
  hasUnread: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  MENTION: "@",
  REPLY: "↩", // ↩
  PROPOSAL_OPENED: "✎", // ✎
  COST_CHANGED: "$",
  PAYMENT_REMINDER: "$",
  PAYMENT_LOGGED: "$",
  PAYMENT_CONFIRMED: "$",
  TRIP_UPDATED: "✉", // ✉
};

function formatMessage(type: string, payload: Record<string, unknown>): string {
  const author = (payload.authorName as string) ?? "Someone";
  const excerpt = (payload.excerpt as string) ?? "";

  switch (type) {
    case "MENTION":
      return `${author} mentioned you: "${excerpt}"`;
    case "REPLY":
      return `${author} replied to your comment: "${excerpt}"`;
    case "PROPOSAL_OPENED":
      return `${author} opened a proposal`;
    case "COST_CHANGED":
      return `Costs were updated`;
    case "PAYMENT_REMINDER":
      return `${String(payload.amount)} is still due for ${String(payload.tripTitle)}`;
    case "PAYMENT_LOGGED":
      return `${author} logged a payment for you to confirm`;
    case "PAYMENT_CONFIRMED":
      return "Your payment was confirmed";
    case "TRIP_UPDATED":
      return `Trip was updated`;
    default:
      return "New notification";
  }
}

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

export function InboxList({ notifications, hasUnread }: InboxListProps) {
  const router = useRouter();

  const handleClick = async (n: NotificationItem) => {
    if (!n.readAt) {
      await markNotificationRead(n.id);
    }
    const tripId = n.payloadJson.tripId as string | undefined;
    if (tripId) {
      const tab = n.type === "COST_CHANGED" || n.type.startsWith("PAYMENT_") ? "costs" : "chat";
      router.push(`/trips/${tripId}?tab=${tab}`);
    } else {
      router.refresh();
    }
  };

  const handleMarkAll = async () => {
    await markAllRead();
    router.refresh();
  };

  return (
    <div>
      {hasUnread && (
        <div style={{ marginBottom: "var(--space-4)", textAlign: "right" }}>
          <button
            type="button"
            onClick={() => void handleMarkAll()}
            style={{
              background: "none",
              border: "1px solid var(--rule)",
              color: "var(--sea)",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font-hanken), system-ui, sans-serif",
              cursor: "pointer",
              padding: "var(--space-2) var(--space-4)",
              minHeight: "44px",
            }}
          >
            Mark all as read
          </button>
        </div>
      )}

      {notifications.length === 0 && (
        <div
          style={{
            padding: "var(--space-12) 0",
            textAlign: "center",
            color: "var(--ink-soft)",
            fontSize: "var(--text-sm)",
          }}
        >
          No notifications yet.
        </div>
      )}

      {notifications.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => void handleClick(n)}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-3)",
            width: "100%",
            padding: "var(--space-4)",
            background: n.readAt ? "transparent" : "var(--paper-2)",
            cursor: "pointer",
            border: "none",
            borderBottom: "1px solid var(--rule)",
            textAlign: "left",
            fontFamily: "var(--font-hanken), system-ui, sans-serif",
            minHeight: "44px",
          }}
        >
          {/* Icon */}
          <span
            style={{
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              color: n.readAt ? "var(--ink-soft)" : "var(--sea)",
              flexShrink: 0,
              fontWeight: 600,
            }}
          >
            {TYPE_ICONS[n.type] ?? "!"}
          </span>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: n.readAt ? "var(--ink-soft)" : "var(--ink)",
                fontWeight: n.readAt ? 400 : 500,
                lineHeight: 1.4,
              }}
            >
              {formatMessage(
                n.type,
                n.payloadJson as Record<string, unknown>,
              )}
            </div>
            <div
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "11px",
                color: "var(--ink-soft)",
                letterSpacing: "0.08em",
                marginTop: "var(--space-1)",
              }}
            >
              {timeAgo(n.createdAt)}
            </div>
          </div>

          {/* Unread indicator */}
          {!n.readAt && (
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "var(--clay)",
                flexShrink: 0,
                marginTop: "6px",
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
