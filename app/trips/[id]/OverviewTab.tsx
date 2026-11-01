import type { TripStatus } from "@prisma/client";
import { Markdown } from "@/components/Markdown";
import { MemberAvatar } from "@/components/MemberAvatar";
import { StatusBadge } from "@/components/StatusBadge";

interface ActivityEntry {
  id: string;
  type: string;
  payloadJson: unknown;
  createdAt: Date;
  actor: { name: string; photoKey: string | null };
}

interface OverviewTabProps {
  description: string;
  startDate: Date | null;
  endDate: Date | null;
  status: TripStatus;
  captain: { name: string; photoKey: string | null };
  activities: ActivityEntry[];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function activityLabel(type: string, payload: unknown): string {
  const p = payload as Record<string, unknown> | null;
  switch (type) {
    case "TRIP_CREATED":
      return p?.title ? `created "${p.title as string}"` : "created this trip";
    case "TRIP_UPDATED": {
      const changes = p?.changes;
      if (Array.isArray(changes) && changes.length > 0) {
        return `updated ${(changes as string[]).join(", ")}`;
      }
      return "updated the trip";
    }
    case "STATUS_CHANGED":
      return `changed status from ${p?.from ?? "?"} to ${p?.to ?? "?"}`;
    default:
      return type.toLowerCase().replace(/_/g, " ");
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-dm-mono)",
  fontSize: "var(--text-xs)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-soft)",
  margin: "0 0 var(--space-3) 0",
};

export function OverviewTab({
  description,
  startDate,
  endDate,
  status,
  captain,
  activities,
}: OverviewTabProps) {
  const nights =
    startDate && endDate ? daysBetween(startDate, endDate) : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "var(--space-8)",
      }}
    >
      {/* Description */}
      {description && (
        <section>
          <p style={sectionLabel}>About</p>
          <Markdown content={description} />
        </section>
      )}

      {/* Dates */}
      <section>
        <p style={sectionLabel}>Dates</p>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <div>
            <span
              style={{
                fontFamily: "var(--font-dm-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--text-soft)",
                display: "block",
              }}
            >
              From
            </span>
            <span style={{ fontSize: "var(--text-base)" }}>
              {startDate ? formatDate(startDate) : "Not set"}
            </span>
          </div>
          <div>
            <span
              style={{
                fontFamily: "var(--font-dm-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--text-soft)",
                display: "block",
              }}
            >
              To
            </span>
            <span style={{ fontSize: "var(--text-base)" }}>
              {endDate ? formatDate(endDate) : "Not set"}
            </span>
          </div>
          <div>
            <span
              style={{
                fontFamily: "var(--font-dm-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--text-soft)",
                display: "block",
              }}
            >
              Nights
            </span>
            <span
              style={{
                fontFamily: "var(--font-dm-mono)",
                fontSize: "var(--text-base)",
              }}
            >
              {nights ?? "—"}
            </span>
          </div>
        </div>
      </section>

      {/* Who is going */}
      <section>
        <p style={sectionLabel}>Who is going</p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <MemberAvatar
            name={captain.name}
            photoKey={captain.photoKey}
            size={36}
          />
          <div>
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
              }}
            >
              {captain.name}
            </span>
            <span
              style={{
                display: "block",
                fontFamily: "var(--font-dm-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--text-soft)",
              }}
            >
              Captain
            </span>
          </div>
        </div>
      </section>

      {/* Status */}
      <section>
        <p style={sectionLabel}>Status</p>
        <StatusBadge status={status} />
      </section>

      {/* Activity feed */}
      {activities.length > 0 && (
        <section>
          <p style={sectionLabel}>Activity</p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            {activities.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  fontSize: "var(--text-sm)",
                }}
              >
                <MemberAvatar
                  name={a.actor.name}
                  photoKey={a.actor.photoKey}
                  size={24}
                />
                <span>
                  <strong style={{ fontWeight: 500 }}>{a.actor.name}</strong>{" "}
                  {activityLabel(a.type, a.payloadJson)}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--font-dm-mono)",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-soft)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {timeAgo(a.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
