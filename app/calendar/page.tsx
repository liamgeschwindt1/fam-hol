import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarMonth } from "./CalendarMonth";
import type { CalendarTrip } from "./CalendarMonth";
import { CalendarAgenda } from "./CalendarAgenda";
import type { AgendaTrip } from "./CalendarAgenda";
import { CalendarYear } from "./CalendarYear";
import type { YearTrip } from "./CalendarYear";
import { SubscriptionPanel } from "./SubscriptionPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendar",
};

interface CalendarPageProps {
  searchParams: Promise<{
    view?: string;
    y?: string;
    m?: string;
  }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const { member, family } = await requireMember();
  const params = await searchParams;

  const view = params.view ?? "month";
  const now = new Date();
  const year = params.y ? parseInt(params.y, 10) : now.getFullYear();
  const month = params.m ? parseInt(params.m, 10) : now.getMonth();

  // Load all trips for this family
  const trips = await db.trip.findMany({
    where: { familyId: family.id },
    select: {
      id: true,
      title: true,
      season: true,
      status: true,
      startDate: true,
      endDate: true,
      captainId: true,
    },
    orderBy: { startDate: "asc" },
  });

  // Load member's attendance
  const attendance = await db.attendance.findMany({
    where: { memberId: member.id },
    select: { tripId: true, status: true },
  });

  // Build attendance map: tripId -> best status
  const attendanceMap = new Map<string, "IN" | "MAYBE">();
  for (const att of attendance) {
    if (att.status === "OUT") continue;
    const existing = attendanceMap.get(att.tripId);
    if (att.status === "IN" || !existing) {
      attendanceMap.set(att.tripId, att.status as "IN" | "MAYBE");
    }
  }

  // Count going per trip (IN attendance, unique members)
  const goingCounts = await db.attendance.groupBy({
    by: ["tripId"],
    where: {
      status: "IN",
      trip: { familyId: family.id },
    },
    _count: { memberId: true },
  });
  const goingCountMap = new Map<string, number>();

  // Actually need distinct members per trip
  const goingRaw = await db.attendance.findMany({
    where: {
      status: "IN",
      trip: { familyId: family.id },
    },
    select: { tripId: true, memberId: true },
    distinct: ["tripId", "memberId"],
  });
  for (const g of goingRaw) {
    goingCountMap.set(g.tripId, (goingCountMap.get(g.tripId) ?? 0) + 1);
  }
  // suppress unused
  void goingCounts;

  // Build base URL for subscription
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  // Prepare data for each view
  const calendarTrips: CalendarTrip[] = trips.map((t) => ({
    id: t.id,
    title: t.title,
    season: t.season,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    memberStatus: attendanceMap.get(t.id) ?? null,
  }));

  const agendaTrips: AgendaTrip[] = trips.map((t) => ({
    id: t.id,
    title: t.title,
    season: t.season,
    status: t.status,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    goingCount: goingCountMap.get(t.id) ?? 0,
    memberStatus: attendanceMap.get(t.id) ?? null,
  }));

  const yearTrips: YearTrip[] = trips.map((t) => ({
    id: t.id,
    title: t.title,
    season: t.season,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
  }));

  function viewUrl(v: string) {
    const p = new URLSearchParams();
    p.set("view", v);
    if (v === "month") {
      p.set("y", String(year));
      p.set("m", String(month));
    }
    if (v === "year") {
      p.set("y", String(year));
    }
    return `/calendar?${p.toString()}`;
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    minHeight: "36px",
    padding: "0 14px",
    fontSize: "var(--text-xs)",
    fontFamily: "var(--font-dm-mono)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    textDecoration: "none",
    border: "1px solid var(--border)",
    borderRadius: "2px",
    backgroundColor: active ? "var(--sea)" : "transparent",
    borderColor: active ? "var(--sea)" : "var(--border)",
    color: active ? "#fff" : "var(--text-soft)",
    transition: "background-color var(--duration-fast) var(--ease-out)",
  });

  return (
    <div
      style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-6)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-6)",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-3xl)",
            fontWeight: 400,
            margin: 0,
            color: "var(--ink)",
          }}
        >
          Calendar
        </h1>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Link href={viewUrl("month")} style={tabStyle(view === "month")}>Month</Link>
          <Link href={viewUrl("agenda")} style={tabStyle(view === "agenda")}>Agenda</Link>
          <Link href={viewUrl("year")} style={tabStyle(view === "year")}>Year</Link>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0 0 var(--space-6) 0" }} />

      {/* View content */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: "var(--space-8)",
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          {view === "month" && (
            <CalendarMonth trips={calendarTrips} year={year} month={month} />
          )}
          {view === "agenda" && (
            <CalendarAgenda trips={agendaTrips} />
          )}
          {view === "year" && (
            <CalendarYear trips={yearTrips} year={year} />
          )}
        </div>

        {/* Sidebar */}
        <aside>
          <SubscriptionPanel
            calendarToken={member.calendarToken}
            baseUrl={baseUrl}
          />
        </aside>
      </div>
    </div>
  );
}
