"use client";

import { MemberAvatar } from "@/components/MemberAvatar";

interface AttendanceGridProps {
  tripId: string;
  startDate: string | null;
  endDate: string | null;
  members: {
    id: string;
    name: string;
    photoKey: string | null;
    isDependent: boolean;
    guardianId: string | null;
  }[];
  attendance: { memberId: string; date: string; status: string }[];
}

function getDays(start: string | null, end: string | null): string[] {
  if (!start || !end) return [];
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

const SHORT_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function AttendanceGrid({
  startDate,
  endDate,
  members,
  attendance,
}: AttendanceGridProps) {
  const days = getDays(startDate, endDate);

  // Build lookup: memberId -> date -> status
  const lookup = new Map<string, Map<string, string>>();
  for (const a of attendance) {
    const dateKey = a.date.slice(0, 10);
    if (!lookup.has(a.memberId)) {
      lookup.set(a.memberId, new Map());
    }
    lookup.get(a.memberId)!.set(dateKey, a.status);
  }

  // Filter to members who have at least one attendance entry
  const activeMembers = members.filter(
    (m) => lookup.has(m.id) && lookup.get(m.id)!.size > 0,
  );

  if (activeMembers.length === 0) {
    return (
      <section>
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
          Who is there when
        </p>
        <p
          style={{
            color: "var(--text-soft)",
            fontStyle: "italic",
            fontSize: "var(--text-sm)",
          }}
        >
          {days.length
            ? "No attendance set yet. Tap the days above to mark yours."
            : "Add trip dates to plan attendance by day."}
        </p>
      </section>
    );
  }

  const cellSize = 28;
  const avatarColWidth = 140;

  return (
    <section>
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
        Who is there when
      </p>

      <div
        style={{
          overflowX: "auto",
          paddingBottom: "var(--space-2)",
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            width: "auto",
          }}
        >
          <thead>
            <tr>
              <th style={{ width: avatarColWidth, minWidth: avatarColWidth }} />
              {days.map((d) => {
                const dt = new Date(d + "T00:00:00Z");
                const wd = SHORT_WEEKDAYS[dt.getUTCDay()]!;
                const dayNum = dt.getUTCDate();
                return (
                  <th
                    key={d}
                    style={{
                      width: cellSize,
                      minWidth: cellSize,
                      textAlign: "center",
                      verticalAlign: "bottom",
                      padding: "0 0 4px 0",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-instrument)",
                        fontSize: "10px",
                        color: "var(--text-soft)",
                        lineHeight: 1,
                      }}
                    >
                      {wd}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-dm-mono)",
                        fontSize: "10px",
                        color: "var(--text-soft)",
                        lineHeight: 1.3,
                      }}
                    >
                      {dayNum}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activeMembers.map((m) => {
              const memberDates = lookup.get(m.id);
              return (
                <tr key={m.id}>
                  <td
                    style={{
                      padding: "4px 8px 4px 0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                      }}
                    >
                      <MemberAvatar
                        name={m.name}
                        photoKey={m.photoKey}
                        size={22}
                      />
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text)",
                          maxWidth: 100,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {m.name}
                      </span>
                    </div>
                  </td>
                  {days.map((d) => {
                    const st = memberDates?.get(d) ?? null;
                    return (
                      <td
                        key={d}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          textAlign: "center",
                          verticalAlign: "middle",
                          padding: 1,
                        }}
                      >
                        <div
                          style={{
                            width: cellSize - 4,
                            height: cellSize - 4,
                            margin: "0 auto",
                            borderRadius: "2px",
                            backgroundColor:
                              st === "IN"
                                ? "var(--moss)"
                                : st === "MAYBE"
                                  ? "color-mix(in srgb, var(--sun) 40%, transparent)"
                                  : "transparent",
                            border:
                              st === "MAYBE"
                                ? "1px dashed var(--sun)"
                                : st === "IN"
                                  ? "none"
                                  : "1px solid var(--border)",
                            opacity: st === "OUT" ? 0.3 : 1,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
