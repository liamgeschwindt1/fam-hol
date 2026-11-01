import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { TripMap } from "@/components/LazyTripMap";
import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import type { MapTrip } from "@/components/TripMap";
import { imageUrl, tripCoverKey } from "@/lib/images";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Map",
};

interface MapPageProps {
  searchParams: Promise<{
    year?: string;
  }>;
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const { family } = await requireMember();
  const params = await searchParams;

  const year = params.year;

  // Build filter
  const where: Prisma.TripWhereInput = {
    familyId: family.id,
    lat: { not: null },
    lng: { not: null },
  };
  if (year && /^\d{4}$/.test(year)) {
    const yr = parseInt(year, 10);
    where.startDate = {
      gte: new Date(`${yr}-01-01T00:00:00Z`),
      lt: new Date(`${yr + 1}-01-01T00:00:00Z`),
    };
  }

  const trips = await db.trip.findMany({
    where,
    include: {
      captain: { select: { name: true } },
      images: {
        orderBy: { sort: "asc" },
        select: { id: true, storageKey: true },
      },
      attendance: {
        where: { status: "IN" },
        select: { memberId: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  const mapTrips: MapTrip[] = trips
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => {
      const uniqueGoing = new Set(t.attendance.map((a) => a.memberId));
      return {
        id: t.id,
        title: t.title,
        season: t.season,
        status: t.status,
        lat: t.lat!,
        lng: t.lng!,
        coverUrl: imageUrl(tripCoverKey(t)),
        startDate: t.startDate?.toISOString() ?? null,
        endDate: t.endDate?.toISOString() ?? null,
        captainName: t.captain.name,
        goingCount: uniqueGoing.size,
      };
    });

  // Collect years
  const allTrips = await db.trip.findMany({
    where: {
      familyId: family.id,
      lat: { not: null },
      startDate: { not: null },
    },
    select: { startDate: true },
    orderBy: { startDate: "desc" },
  });
  const years = [...new Set(allTrips.flatMap((t) => t.startDate ? [t.startDate.getFullYear()] : []))].sort(
    (a, b) => b - a,
  );

  function buildFilterUrl(key: string, value: string | null) {
    const p = new URLSearchParams();
    if (year) p.set("year", year);
    if (value) {
      p.set(key, value);
    } else {
      p.delete(key);
    }
    const qs = p.toString();
    return `/map${qs ? `?${qs}` : ""}`;
  }

  const chipBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "32px",
    padding: "0 10px",
    fontSize: "var(--text-xs)",
    fontFamily: "var(--font-dm-mono)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    border: "1px solid var(--border)",
    borderRadius: "2px",
    textDecoration: "none",
    transition: "background-color var(--duration-fast) var(--ease-out)",
  };

  const chipActive: React.CSSProperties = {
    ...chipBase,
    backgroundColor: "var(--sea)",
    borderColor: "var(--sea)",
    color: "#fff",
  };

  const chipInactive: React.CSSProperties = {
    ...chipBase,
    backgroundColor: "transparent",
    color: "var(--text-soft)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 57px)" }}>
      {/* Filter bar */}
      <div
        style={{
          padding: "var(--space-3) var(--space-6)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: "var(--space-4)",
          alignItems: "center",
          flexWrap: "wrap",
          backgroundColor: "var(--bg)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-xl)",
            fontWeight: 400,
            margin: 0,
            color: "var(--ink)",
            marginRight: "var(--space-4)",
          }}
        >
          Map
        </h1>

        {years.length > 0 && (
          <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", alignItems: "center" }}>
            <span className="label-caps" style={{ marginRight: "var(--space-1)" }}>Year</span>
            {years.map((y) => {
              const yStr = String(y);
              return (
                <Link
                  key={y}
                  href={buildFilterUrl("year", year === yStr ? null : yStr)}
                  style={year === yStr ? chipActive : chipInactive}
                >
                  {y}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <TripMap trips={mapTrips} />
      </div>
    </div>
  );
}
