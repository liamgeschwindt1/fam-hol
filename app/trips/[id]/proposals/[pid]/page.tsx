import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { ProposalReview } from "./ProposalReview";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; pid: string }>;
}

export default async function ProposalPage({ params }: PageProps) {
  const { member, family } = await requireMember();
  const { id, pid } = await params;

  const proposal = await db.proposal.findUnique({
    where: { id: pid },
    include: {
      author: {
        select: { id: true, name: true, photoKey: true },
      },
      mergedBy: {
        select: { name: true },
      },
      changes: {
        orderBy: { createdAt: "asc" },
      },
      supporters: {
        include: {
          member: {
            select: { name: true, photoKey: true },
          },
        },
      },
      trip: {
        select: { familyId: true, captainId: true, title: true },
      },
    },
  });

  if (!proposal || proposal.tripId !== id || proposal.trip.familyId !== family.id) {
    notFound();
  }

  const isCaptain = proposal.trip.captainId === member.id;

  const proposalData = {
    id: proposal.id,
    tripId: proposal.tripId,
    title: proposal.title,
    descriptionMd: proposal.descriptionMd,
    status: proposal.status,
    baseRevision: proposal.baseRevision,
    rejectReason: proposal.rejectReason,
    createdAt: proposal.createdAt.toISOString(),
    author: proposal.author,
    mergedBy: proposal.mergedBy,
    mergedAt: proposal.mergedAt?.toISOString() ?? null,
    changes: proposal.changes.map((c) => ({
      id: c.id,
      type: c.type,
      targetId: c.targetId,
      beforeJson: c.beforeJson,
      afterJson: c.afterJson,
      state: c.state,
    })),
    supporters: proposal.supporters.map((s) => ({
      memberId: s.memberId,
      member: s.member,
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
      <div style={{ marginBottom: "var(--space-4)" }}>
        <Link
          href={`/trips/${id}?tab=proposals`}
          style={{
            color: "var(--text-soft)",
            fontSize: "var(--text-sm)",
            textDecoration: "none",
          }}
        >
          &larr; Back to {proposal.trip.title}
        </Link>
      </div>

      <h1
        className="font-display"
        style={{
          fontSize: "var(--text-2xl)",
          margin: "0 0 var(--space-6) 0",
        }}
      >
        {proposal.title}
      </h1>

      <ProposalReview
        proposal={proposalData}
        isCaptain={isCaptain}
        currentMemberId={member.id}
      />
    </div>
  );
}
