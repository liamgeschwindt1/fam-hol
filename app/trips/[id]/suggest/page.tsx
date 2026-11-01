import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { SuggestMode } from "./SuggestMode";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SuggestPage({ params }: PageProps) {
  const { family } = await requireMember();
  const { id } = await params;

  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      programItems: {
        orderBy: { sort: "asc" },
      },
      stayOptions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          url: true,
          priceNote: true,
          rooms: true,
          capacity: true,
          pros: true,
          cons: true,
        },
      },
    },
  });

  if (!trip || trip.familyId !== family.id) {
    notFound();
  }

  const tripData = {
    id: trip.id,
    title: trip.title,
    tagline: trip.tagline,
    descriptionMd: trip.descriptionMd,
    startDate: trip.startDate.toISOString().split("T")[0]!,
    endDate: trip.endDate.toISOString().split("T")[0]!,
    season: trip.season,
    revision: trip.revision,
    programItems: trip.programItems.map((p) => ({
      id: p.id,
      date: p.date.toISOString().split("T")[0]!,
      time: p.time,
      title: p.title,
      notes: p.notes,
      placeName: p.placeName,
      url: p.url,
      sort: p.sort,
    })),
    stayOptions: trip.stayOptions.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      priceNote: s.priceNote,
      rooms: s.rooms,
      capacity: s.capacity,
      pros: s.pros,
      cons: s.cons,
    })),
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ marginBottom: "var(--space-6)" }}>
        <Link
          href={`/trips/${trip.id}?tab=proposals`}
          style={{
            color: "var(--text-soft)",
            fontSize: "var(--text-sm)",
            textDecoration: "none",
          }}
        >
          &larr; Back to trip
        </Link>
      </div>

      <h1
        className="font-display"
        style={{
          fontSize: "var(--text-2xl)",
          margin: "0 0 var(--space-2) 0",
        }}
      >
        Suggest changes
      </h1>
      <p style={{ color: "var(--text-soft)", margin: "0 0 var(--space-8) 0" }}>
        Edit any field below. When you are done, review and submit your proposal
        for the captain to consider.
      </p>

      <SuggestMode trip={tripData} />
    </div>
  );
}
