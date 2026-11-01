import { db } from "@/lib/db";
import ical, { ICalEventStatus } from "ical-generator";
import { NextResponse } from "next/server";
import { computeCosts } from "@/lib/costs/compute";
import { formatMoney } from "@/lib/costs/money";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { token: rawToken } = await params;

  // Strip .ics extension if present
  const token = rawToken.replace(/\.ics$/i, "");

  // Look up member by calendar token — no session auth
  const member = await db.member.findUnique({
    where: { calendarToken: token },
    select: {
      id: true,
      name: true,
      familyId: true,
      calendarShowCosts: true,
      calendarRevision: true,
      updatedAt: true,
    },
  });

  if (!member) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Load trips member has attendance for, plus trips they captain
  const [attendedTrips, captainedTrips] = await Promise.all([
    db.trip.findMany({
      where: {
        familyId: member.familyId,
        attendance: {
          some: {
            memberId: member.id,
            status: { in: ["IN", "MAYBE"] },
          },
        },
      },
      include: {
        attendance: {
          where: { memberId: member.id },
          select: { date: true, status: true, updatedAt: true },
          orderBy: { date: "asc" },
        },
        chosenStay: { select: { title: true } },
      },
    }),
    db.trip.findMany({
      where: {
        captainId: member.id,
        familyId: member.familyId,
        attendance: {
          none: {
            memberId: member.id,
            status: { in: ["IN", "MAYBE"] },
          },
        },
      },
      include: {
        attendance: {
          where: { memberId: member.id },
          select: { date: true, status: true, updatedAt: true },
          orderBy: { date: "asc" },
        },
        chosenStay: { select: { title: true } },
      },
    }),
  ]);

  const allTrips = [...attendedTrips, ...captainedTrips];

  const cal = ical({
    name: `${member.name}'s Family Trips`,
    prodId: { company: "Family Trips", product: "Calendar Feed" },
    ttl: 3600, // PT1H
  });

  // Set X-PUBLISHED-TTL
  cal.x([{ key: "X-PUBLISHED-TTL", value: "PT1H" }]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const trip of allTrips) {
    const lastModified =
      trip.updatedAt > member.updatedAt ? trip.updatedAt : member.updatedAt;
    const sequence = trip.revision + member.calendarRevision;
    const attendanceDays = trip.attendance;

    // Determine IN days and MAYBE days
    const inDays = attendanceDays
      .filter((a) => a.status === "IN")
      .map((a) => a.date);
    const maybeDays = attendanceDays
      .filter((a) => a.status === "MAYBE")
      .map((a) => a.date);
    const outDays = attendanceDays.filter((a) => a.status === "OUT");

    // Build contiguous runs of IN days
    const inRuns = buildRuns(inDays);
    const maybeOnlyDays = maybeDays.filter(
      (d) => !inDays.some((id) => sameDay(id, d)),
    );
    const maybeRuns = buildRuns(maybeOnlyDays);

    const stayInfo = trip.chosenStay?.title ?? "";
    const tripUrl = new URL(
      `/trips/${trip.id}`,
      process.env.APP_URL ?? _request.url,
    ).toString();
    let costInfo = "";
    if (member.calendarShowCosts) {
      const costs = await computeCosts(trip.id);
      const memberCost = costs.perMember.find((m) => m.memberId === member.id);
      if (!memberCost)
        throw new Error(
          "Calendar member is missing from the trip cost calculation",
        );
      costInfo = `Your share: ${formatMoney(memberCost.totalMinor, trip.currency)} ${trip.currency}`;
    }

    let runIndex = 0;
    for (const run of inRuns) {
      const endDate = new Date(run.end);
      endDate.setDate(endDate.getDate() + 1); // all-day events need exclusive end

      cal.createEvent({
        id: `trip-${trip.id}-${runIndex}@familytrips`,
        summary: trip.title,
        start: run.start,
        end: endDate,
        allDay: true,
        description: [tripUrl, stayInfo, costInfo].filter(Boolean).join("\n"),
        sequence,
        stamp: lastModified,
        lastModified,
      });
      runIndex++;
    }

    for (const run of maybeRuns) {
      const endDate = new Date(run.end);
      endDate.setDate(endDate.getDate() + 1);

      cal.createEvent({
        id: `trip-${trip.id}-${runIndex}@familytrips`,
        summary: `Maybe: ${trip.title}`,
        start: run.start,
        end: endDate,
        allDay: true,
        description: [tripUrl, stayInfo, costInfo].filter(Boolean).join("\n"),
        sequence,
        stamp: lastModified,
        lastModified,
        status: ICalEventStatus.TENTATIVE,
      });
      runIndex++;
    }

    // If captain but no attendance entries at all, add the full trip range
    if (
      inRuns.length === 0 &&
      maybeRuns.length === 0 &&
      trip.captainId === member.id
    ) {
      const endDate = new Date(trip.endDate);
      endDate.setDate(endDate.getDate() + 1);

      cal.createEvent({
        id: `trip-${trip.id}-captain@familytrips`,
        summary: trip.title,
        start: trip.startDate,
        end: endDate,
        allDay: true,
        description: [tripUrl, stayInfo, costInfo, "You are the captain"]
          .filter(Boolean)
          .join("\n"),
        sequence,
        stamp: lastModified,
        lastModified,
      });
    }

    // Handle cancelled (OUT) attendance — show as cancelled for 30 days
    for (const out of outDays) {
      if (out.updatedAt < thirtyDaysAgo) continue;
      cal.createEvent({
        id: `trip-${trip.id}-cancelled-${out.date.toISOString().split("T")[0]}@familytrips`,
        summary: trip.title,
        start: out.date,
        end: out.date,
        allDay: true,
        status: ICalEventStatus.CANCELLED,
        sequence: trip.revision,
        stamp: out.updatedAt,
      });
    }
  }

  const body = cal.toString();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=family-trips.ics",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface DateRun {
  start: Date;
  end: Date;
}

function buildRuns(dates: Date[]): DateRun[] {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const runs: DateRun[] = [];
  let start = sorted[0]!;
  let end = sorted[0]!;

  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i]!;
    const diff = (d.getTime() - end.getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 1.5) {
      end = d;
    } else {
      runs.push({ start, end });
      start = d;
      end = d;
    }
  }
  runs.push({ start, end });
  return runs;
}
