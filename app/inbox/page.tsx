import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { InboxList } from "./InboxList";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inbox",
};

export default async function InboxPage() {
  const { member } = await requireMember();

  const notifications = await db.notification.findMany({
    where: { memberId: member.id },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
  });

  // Sort: unread first (readAt is null), then read, each group by createdAt desc
  const sorted = [...notifications].sort((a, b) => {
    const aUnread = a.readAt === null ? 0 : 1;
    const bUnread = b.readAt === null ? 0 : 1;
    if (aUnread !== bUnread) return aUnread - bUnread;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const hasUnread = sorted.some((n) => n.readAt === null);

  const items = sorted.map((n) => ({
    id: n.id,
    type: n.type,
    payloadJson: n.payloadJson as Record<string, unknown>,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        padding: "var(--space-6)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-instrument), Georgia, serif",
          fontSize: "var(--text-2xl)",
          fontWeight: 400,
          color: "var(--ink)",
          marginBottom: "var(--space-6)",
        }}
      >
        Inbox
      </h1>

      <InboxList notifications={items} hasUnread={hasUnread} />
    </div>
  );
}
