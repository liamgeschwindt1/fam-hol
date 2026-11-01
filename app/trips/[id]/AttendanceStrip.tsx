"use client";

import { useTransition } from "react";
import { updateAttendance, bulkUpdateAttendance } from "./attendance-actions";

interface AttendanceStripProps {
  tripId: string;
  memberId: string;
  startDate: string;
  endDate: string;
  attendance: { memberId: string; date: string; status: string }[];
}

function getDays(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  const cur = new Date(s);
  while (cur <= e) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function statusColor(status: string | null): string {
  switch (status) {
    case "IN":
      return "var(--moss)";
    case "MAYBE":
      return "var(--sun)";
    case "OUT":
      return "transparent";
    default:
      return "transparent";
  }
}

function statusBorder(status: string | null): string {
  switch (status) {
    case "IN":
      return "var(--moss)";
    case "MAYBE":
      return "var(--sun)";
    case "OUT":
      return "var(--border)";
    default:
      return "var(--border)";
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "IN":
      return "In";
    case "MAYBE":
      return "Maybe";
    case "OUT":
      return "Out";
    default:
      return "";
  }
}

function nextStatus(
  current: string | null,
): "IN" | "MAYBE" | "OUT" | null {
  switch (current) {
    case null:
      return "IN";
    case "IN":
      return "MAYBE";
    case "MAYBE":
      return "OUT";
    case "OUT":
      return null;
    default:
      return "IN";
  }
}

export function AttendanceStrip({
  tripId,
  memberId,
  startDate,
  endDate,
  attendance,
}: AttendanceStripProps) {
  const [isPending, startTransition] = useTransition();
  const days = getDays(startDate, endDate);

  const statusMap = new Map<string, string>();
  for (const a of attendance) {
    statusMap.set(a.date.slice(0, 10), a.status);
  }

  function handleDayClick(dateStr: string) {
    const current = statusMap.get(dateStr) ?? null;
    const next = nextStatus(current);
    startTransition(async () => {
      await updateAttendance(tripId, memberId, dateStr, next);
    });
  }

  function handleAllDays() {
    startTransition(async () => {
      await bulkUpdateAttendance(tripId, memberId, days, "IN");
    });
  }

  function handleArriveLater() {
    if (days.length < 2) return;
    const laterDays = days.slice(1);
    startTransition(async () => {
      await bulkUpdateAttendance(tripId, memberId, laterDays, "IN");
      await updateAttendance(tripId, memberId, days[0]!, null);
    });
  }

  function handleLeaveEarlier() {
    if (days.length < 2) return;
    const earlierDays = days.slice(0, -1);
    startTransition(async () => {
      await bulkUpdateAttendance(tripId, memberId, earlierDays, "IN");
      await updateAttendance(tripId, memberId, days[days.length - 1]!, null);
    });
  }

  const quickBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "32px",
    padding: "0 12px",
    fontSize: "var(--text-xs)",
    fontFamily: "var(--font-dm-mono)",
    letterSpacing: "0.04em",
    backgroundColor: "transparent",
    color: "var(--text-soft)",
    border: "1px solid var(--border)",
    borderRadius: "2px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <section style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}>
      <p
        style={{
          fontFamily: "var(--font-dm-mono)",
          fontSize: "var(--text-xs)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-soft)",
          margin: "0 0 var(--space-3) 0",
        }}
      >
        Your attendance
      </p>

      <div
        style={{
          display: "flex",
          gap: "var(--space-1)",
          overflowX: "auto",
          paddingBottom: "var(--space-2)",
        }}
      >
        {days.map((d) => {
          const dt = new Date(d + "T00:00:00Z");
          const weekday = WEEKDAYS[dt.getUTCDay()]!;
          const dayNum = dt.getUTCDate();
          const st = statusMap.get(d) ?? null;

          return (
            <button
              key={d}
              type="button"
              onClick={() => handleDayClick(d)}
              title={`${d}: ${statusLabel(st) || "Not set"}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                padding: "6px 8px",
                minWidth: "44px",
                minHeight: "44px",
                backgroundColor:
                  st === "IN"
                    ? "color-mix(in srgb, var(--moss) 15%, transparent)"
                    : st === "MAYBE"
                      ? "color-mix(in srgb, var(--sun) 15%, transparent)"
                      : "transparent",
                border: `1px solid ${statusBorder(st)}`,
                borderRadius: "2px",
                cursor: "pointer",
                transition: "background-color 100ms",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-instrument)",
                  fontSize: "11px",
                  color: statusColor(st) || "var(--text-soft)",
                }}
              >
                {weekday}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 500,
                  color: st ? statusColor(st) : "var(--text)",
                }}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          marginTop: "var(--space-2)",
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={handleAllDays} style={quickBtnStyle}>
          All days
        </button>
        <button type="button" onClick={handleArriveLater} style={quickBtnStyle}>
          Arrive later
        </button>
        <button type="button" onClick={handleLeaveEarlier} style={quickBtnStyle}>
          Leave earlier
        </button>
      </div>
    </section>
  );
}
