import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { TripCard } from "@/components/TripCard";
import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { imageUrl, tripCoverKey } from "@/lib/images";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trips",
};

interface TripsPageProps {
  searchParams: Promise<{
    year?: string;
    q?: string;
  }>;
}

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const { family } = await requireMember();
  const params = await searchParams;

  const year = params.year;
  const q = params.q ?? "";

  const where: Prisma.TripWhereInput = { familyId: family.id };
  if (year && /^\d{4}$/.test(year)) {
    const yr = parseInt(year, 10);
    where.startDate = {
      gte: new Date(`${yr}-01-01T00:00:00Z`),
      lt: new Date(`${yr + 1}-01-01T00:00:00Z`),
    };
  }
  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }

  const trips = await db.trip.findMany({
    where,
    include: {
      captain: { select: { name: true, photoKey: true } },
      images: {
        orderBy: { sort: "asc" },
        select: { id: true, storageKey: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  // Collect years for filter
  const allTrips = await db.trip.findMany({
    where: { familyId: family.id, startDate: { not: null } },
    select: { startDate: true },
    orderBy: { startDate: "desc" },
  });
  const years = [
    ...new Set(
      allTrips.flatMap((t) =>
        t.startDate ? [t.startDate.getFullYear()] : [],
      ),
    ),
  ].sort((a, b) => b - a);

  function buildFilterUrl(key: string, value: string | null) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (year) p.set("year", year);
    if (value) {
      p.set(key, value);
    } else {
      p.delete(key);
    }
    const qs = p.toString();
    return `/trips${qs ? `?${qs}` : ""}`;
  }

  const chipBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "36px",
    padding: "0 12px",
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
          Trips
        </h1>
        <Link
          href="/trips/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "44px",
            padding: "0 24px",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            fontFamily: "var(--font-hanken)",
            backgroundColor: "var(--sea)",
            color: "#fff",
            border: "none",
            borderRadius: "2px",
            textDecoration: "none",
            transition:
              "background-color var(--duration-fast) var(--ease-out)",
          }}
        >
          New trip
        </Link>
      </div>

      {/* Search */}
      <form
        action="/trips"
        method="get"
        style={{ marginBottom: "var(--space-4)" }}
      >
        <input
          name="q"
          type="text"
          placeholder="Search trips..."
          defaultValue={q}
          style={{
            width: "100%",
            maxWidth: "360px",
            padding: "10px 12px",
            fontSize: "var(--text-base)",
            fontFamily: "var(--font-hanken)",
            backgroundColor: "var(--bg)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "2px",
            outline: "none",
            minHeight: "44px",
          }}
        />
      </form>

      {years.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            marginBottom: "var(--space-6)",
          }}
        >
          <span className="label-caps" style={{ marginRight: "var(--space-1)", alignSelf: "center" }}>
            Year
          </span>
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

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0 0 var(--space-6) 0" }} />

      {/* Grid */}
      {trips.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "var(--space-16) var(--space-6)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-instrument)",
              fontSize: "var(--text-2xl)",
              fontStyle: "italic",
              color: "var(--text-soft)",
              margin: "0 0 var(--space-4) 0",
            }}
          >
            No trips yet.
          </p>
          <p style={{ color: "var(--text-soft)", margin: "0 0 var(--space-6) 0" }}>
            Be the first to suggest a long weekend.
          </p>
          <Link
            href="/trips/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "44px",
              padding: "0 24px",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              fontFamily: "var(--font-hanken)",
              backgroundColor: "var(--sea)",
              color: "#fff",
              border: "none",
              borderRadius: "2px",
              textDecoration: "none",
            }}
          >
            Plan a trip
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-6)",
          }}
        >
          {trips.map((trip) => {
            const coverUrl = imageUrl(tripCoverKey(trip));

            return (
              <TripCard
                key={trip.id}
                id={trip.id}
                title={trip.title}
                coverUrl={coverUrl}
                season={trip.season}
                status={trip.status}
                startDate={trip.startDate?.toISOString() ?? null}
                endDate={trip.endDate?.toISOString() ?? null}
                captain={trip.captain}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
