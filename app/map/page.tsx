import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { TripMap } from "@/components/LazyTripMap";
import Link from "next/link";
import type { Metadata } from "next";
import type { Season, TripStatus } from "@prisma/client";
import type { MapTrip } from "@/components/TripMap";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Map",
};

const S3_BASE = process.env.NEXT_PUBLIC_S3_BASE_URL ?? "";

const SEASON_OPTIONS: { value: Season; label: string }[] = [
  { value: "SNOW", label: "Snow" },
  { value: "SURF", label: "Surf" },
  { value: "EASTER", label: "Easter" },
  { value: "CHRISTMAS", label: "Christmas" },
  { value: "NYE", label: "NYE" },
  { value: "SUMMER", label: "Summer" },
  { value: "CITY", label: "City" },
];

const STATUS_OPTIONS: { value: TripStatus; label: string }[] = [
  { value: "IDEA", label: "Idea" },
  { value: "PLANNING", label: "Planning" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "HAPPENING", label: "Happening" },
  { value: "DONE", label: "Done" },
];

interface MapPageProps {
  searchParams: Promise<{
    season?: string;
    status?: string;
    year?: string;
  }>;
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const { family } = await requireMember();
  const params = await searchParams;

  const season = params.season as Season | undefined;
  const status = params.status as TripStatus | undefined;
  const year = params.year;

  // Build filter
  const where: Record<string, unknown> = {
    familyId: family.id,
    lat: { not: null },
    lng: { not: null },
  };
  if (season && SEASON_OPTIONS.some((s) => s.value === season)) {
    where.season = season;
  }
  if (status && STATUS_OPTIONS.some((s) => s.value === status)) {
    where.status = status;
  }
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
        take: 1,
        orderBy: { sort: "asc" },
        select: { storageKey: true },
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
      const coverKey = t.images[0]?.storageKey;
      const uniqueGoing = new Set(t.attendance.map((a) => a.memberId));
      return {
        id: t.id,
        title: t.title,
        season: t.season,
        status: t.status,
        lat: t.lat!,
        lng: t.lng!,
        coverUrl: coverKey && S3_BASE ? `${S3_BASE}/${coverKey}` : null,
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
    if (season) p.set("season", season);
    if (status) p.set("status", status);
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

        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", alignItems: "center" }}>
          <span className="label-caps" style={{ marginRight: "var(--space-1)" }}>Season</span>
          {SEASON_OPTIONS.map((s) => (
            <Link
              key={s.value}
              href={buildFilterUrl("season", season === s.value ? null : s.value)}
              style={season === s.value ? chipActive : chipInactive}
            >
              {s.label}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", alignItems: "center" }}>
          <span className="label-caps" style={{ marginRight: "var(--space-1)" }}>Status</span>
          {STATUS_OPTIONS.map((s) => (
            <Link
              key={s.value}
              href={buildFilterUrl("status", status === s.value ? null : s.value)}
              style={status === s.value ? chipActive : chipInactive}
            >
              {s.label}
            </Link>
          ))}
        </div>

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
