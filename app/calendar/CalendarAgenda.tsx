"use client";

import Link from "next/link";
import type { Season, TripStatus } from "@prisma/client";
import { SeasonChip } from "@/components/SeasonChip";
import { StatusBadge } from "@/components/StatusBadge";

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

export interface AgendaTrip {
  id: string;
  title: string;
  season: Season;
  status: TripStatus;
  startDate: string | null;
  endDate: string | null;
  goingCount: number;
  memberStatus: "IN" | "MAYBE" | null;
}

interface CalendarAgendaProps {
  trips: AgendaTrip[];
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "Dates to be decided";
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = s.toLocaleDateString("en-GB", opts);
  const endStr = e.toLocaleDateString("en-GB", { ...opts, year: "numeric" });
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${endStr}`;
  }
  return `${startStr} – ${endStr}`;
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "Date not set";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "In progress";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

export function CalendarAgenda({ trips }: CalendarAgendaProps) {
  const sorted = [...trips].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
  const now = new Date();
  const undated = sorted.filter((trip) => !trip.startDate || !trip.endDate);
  const upcoming = sorted.filter((t) => t.endDate && new Date(t.endDate) >= now);
  const past = sorted.filter((t) => t.endDate && new Date(t.endDate) < now).reverse();

  return (
    <div>
      <h2
        style={{
          fontFamily: "var(--font-instrument)",
          fontSize: "var(--text-2xl)",
          fontWeight: 400,
          margin: "0 0 var(--space-4) 0",
          color: "var(--ink)",
        }}
      >
        Upcoming
      </h2>

      {upcoming.length === 0 && (
        <p style={{ color: "var(--text-soft)", fontStyle: "italic" }}>No upcoming trips.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {upcoming.map((trip) => (
          <AgendaItem key={trip.id} trip={trip} />
        ))}
      </div>

      {undated.length > 0 && (
        <>
          <h2
            style={{
              fontFamily: "var(--font-instrument)",
              fontSize: "var(--text-2xl)",
              fontWeight: 400,
              margin: "var(--space-8) 0 var(--space-4) 0",
              color: "var(--ink)",
            }}
          >
            Dates to be decided
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {undated.map((trip) => (
              <AgendaItem key={trip.id} trip={trip} />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2
            style={{
              fontFamily: "var(--font-instrument)",
              fontSize: "var(--text-2xl)",
              fontWeight: 400,
              margin: "var(--space-8) 0 var(--space-4) 0",
              color: "var(--ink)",
            }}
          >
            Past
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {past.map((trip) => (
              <AgendaItem key={trip.id} trip={trip} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AgendaItem({ trip }: { trip: AgendaTrip }) {
  const color = SEASON_HEX[trip.season];
  const isSolid = trip.memberStatus === "IN";

  return (
    <Link
      href={`/trips/${trip.id}`}
      style={{
        display: "flex",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
        borderRadius: "2px",
        textDecoration: "none",
        color: "inherit",
        backgroundColor: isSolid ? "color-mix(in srgb, var(--paper-2) 50%, transparent)" : "transparent",
        transition: "background-color var(--duration-fast) var(--ease-out)",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-1)" }}>
          <span
            style={{
              fontFamily: "var(--font-instrument)",
              fontSize: "var(--text-lg)",
              fontWeight: 400,
              color: "var(--ink)",
            }}
          >
            {trip.title}
          </span>
          <SeasonChip season={trip.season} />
          <StatusBadge status={trip.status} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--text-soft)",
              letterSpacing: "0.04em",
            }}
          >
            {formatDateRange(trip.startDate, trip.endDate)}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-soft)" }}>
            {trip.goingCount} going
          </span>
          {trip.memberStatus && (
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-dm-mono)",
                color: trip.memberStatus === "IN" ? "var(--moss)" : "var(--sun)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {trip.memberStatus === "IN" ? "Going" : "Maybe"}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-dm-mono)",
          fontSize: "var(--text-xs)",
          color: "var(--text-soft)",
          whiteSpace: "nowrap",
          alignSelf: "center",
        }}
      >
        {daysUntil(trip.startDate)}
      </div>
    </Link>
  );
}
