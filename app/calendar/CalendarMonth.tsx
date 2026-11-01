"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Season } from "@prisma/client";

const SEASON_HEX: Record<Season, string> = {
  SNOW: "var(--season-snow)",
  SURF: "var(--season-surf)",
  EASTER: "var(--season-easter)",
  CHRISTMAS: "var(--season-christmas)",
  NYE: "var(--season-nye)",
  SUMMER: "var(--season-summer)",
  CITY: "var(--season-city)",
  OTHER: "var(--text-soft)",
};

export interface CalendarTrip {
  id: string;
  title: string;
  season: Season;
  startDate: string; // ISO
  endDate: string;   // ISO
  memberStatus: "IN" | "MAYBE" | null; // null = not responded
}

interface CalendarMonthProps {
  trips: CalendarTrip[];
  year: number;
  month: number; // 0-11
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarMonth({ trips, year, month }: CalendarMonthProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday-based: 0=Mon ... 6=Sun
  const startDow = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  // Build grid cells (pad start with empty)
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  // Pad end to complete row
  while (cells.length % 7 !== 0) cells.push(null);

  // Index trips by date
  const tripsByDate = new Map<string, CalendarTrip[]>();
  for (const trip of trips) {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const cur = new Date(start);
    while (cur <= end) {
      if (cur.getMonth() === month && cur.getFullYear() === year) {
        const key = dateKey(cur);
        const arr = tripsByDate.get(key) ?? [];
        arr.push(trip);
        tripsByDate.set(key, arr);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  function navigate(dir: -1 | 1) {
    let newMonth = month + dir;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "month");
    p.set("y", String(newYear));
    p.set("m", String(newMonth));
    router.push(`/calendar?${p.toString()}`);
  }

  return (
    <div>
      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "2px",
            padding: "6px 12px",
            cursor: "pointer",
            color: "var(--text)",
            fontFamily: "var(--font-hanken)",
            fontSize: "var(--text-sm)",
          }}
        >
          &larr;
        </button>
        <h2
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-2xl)",
            fontWeight: 400,
            margin: 0,
            color: "var(--ink)",
            minWidth: "200px",
            textAlign: "center",
          }}
        >
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={() => navigate(1)}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "2px",
            padding: "6px 12px",
            cursor: "pointer",
            color: "var(--text)",
            fontFamily: "var(--font-hanken)",
            fontSize: "var(--text-sm)",
          }}
        >
          &rarr;
        </button>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          border: "1px solid var(--border)",
          borderRadius: "2px",
        }}
      >
        {/* Day headers */}
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="label-caps"
            style={{
              padding: "var(--space-2) var(--space-1)",
              textAlign: "center",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--paper-2)",
            }}
          >
            {d}
          </div>
        ))}

        {/* Day cells */}
        {cells.map((day, i) => {
          const isToday = day != null && sameDay(new Date(year, month, day), today);
          const key = day != null ? dateKey(new Date(year, month, day)) : "";
          const dayTrips = day != null ? (tripsByDate.get(key) ?? []) : [];

          return (
            <div
              key={i}
              style={{
                minHeight: "80px",
                padding: "4px",
                borderRight: (i + 1) % 7 !== 0 ? "1px solid var(--border)" : undefined,
                borderBottom: i < cells.length - 7 ? "1px solid var(--border)" : undefined,
                backgroundColor: isToday ? "color-mix(in srgb, var(--sea) 8%, transparent)" : "transparent",
              }}
            >
              {day != null && (
                <>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      fontFamily: "var(--font-dm-mono)",
                      color: isToday ? "var(--sea)" : "var(--text-soft)",
                      fontWeight: isToday ? 600 : 400,
                      marginBottom: "2px",
                    }}
                  >
                    {day}
                  </div>
                  {dayTrips.slice(0, 3).map((trip) => {
                    const color = SEASON_HEX[trip.season];
                    const isSolid = trip.memberStatus === "IN";
                    const isDashed = trip.memberStatus === "MAYBE" || trip.memberStatus === null;
                    return (
                      <Link
                        key={trip.id}
                        href={`/trips/${trip.id}`}
                        style={{
                          display: "block",
                          fontSize: "10px",
                          lineHeight: "16px",
                          padding: "0 4px",
                          marginBottom: "1px",
                          borderRadius: "1px",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: isSolid ? "#fff" : color,
                          backgroundColor: isSolid ? color : "transparent",
                          border: isDashed ? `1px dashed ${color}` : "none",
                          fontFamily: "var(--font-hanken)",
                        }}
                        title={trip.title}
                      >
                        {trip.title}
                      </Link>
                    );
                  })}
                  {dayTrips.length > 3 && (
                    <div style={{ fontSize: "9px", color: "var(--text-soft)", fontFamily: "var(--font-dm-mono)" }}>
                      +{dayTrips.length - 3} more
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
