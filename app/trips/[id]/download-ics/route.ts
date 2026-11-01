import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import ical, { ICalEventStatus } from "ical-generator";
import { NextResponse } from "next/server";
import { computeCosts } from "@/lib/costs/compute";
import { formatMoney } from "@/lib/costs/money";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { member, family } = await requireMember();
  const { id } = await params;

  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      chosenStay: { select: { title: true } },
      attendance: {
        where: { memberId: member.id },
        select: { date: true, status: true },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!trip || trip.familyId !== family.id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const cal = ical({
    name: trip.title,
    prodId: { company: "Family Trips", product: "Trip Download" },
  });

  const endDate = new Date(trip.endDate);
  endDate.setDate(endDate.getDate() + 1);

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
  const description = [tripUrl, stayInfo, trip.placeName, costInfo]
    .filter(Boolean)
    .join("\n");

  // Check member's status
  const inDays = trip.attendance.filter((a) => a.status === "IN");
  const maybeDays = trip.attendance.filter((a) => a.status === "MAYBE");
  const isMaybe = inDays.length === 0 && maybeDays.length > 0;

  cal.createEvent({
    id: `trip-${trip.id}@familytrips`,
    summary: isMaybe ? `Maybe: ${trip.title}` : trip.title,
    start: trip.startDate,
    end: endDate,
    allDay: true,
    location: trip.placeName ?? undefined,
    description,
    sequence: trip.revision + member.calendarRevision,
    stamp: trip.updatedAt,
    lastModified:
      trip.updatedAt > member.updatedAt ? trip.updatedAt : member.updatedAt,
    status: isMaybe ? ICalEventStatus.TENTATIVE : ICalEventStatus.CONFIRMED,
  });

  const body = cal.toString();
  const filename = trip.title
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/ +/g, "-")
    .toLowerCase();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
    },
  });
}
