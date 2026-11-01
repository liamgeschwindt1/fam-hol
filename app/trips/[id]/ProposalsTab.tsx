"use client";

import Link from "next/link";
import { MemberAvatar } from "@/components/MemberAvatar";
import type { ProposalStatus } from "@prisma/client";

interface ProposalSummary {
  id: string;
  tripId: string;
  title: string;
  status: ProposalStatus;
  createdAt: string;
  author: { name: string; photoKey: string | null };
  _count: { changes: number; supporters: number };
}

interface ProposalsTabProps {
  tripId: string;
  proposals: ProposalSummary[];
}

export function ProposalsTab({ tripId, proposals }: ProposalsTabProps) {
  const open = proposals.filter((p) => p.status === "OPEN");
  const closed = proposals.filter((p) => p.status !== "OPEN");

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-6)",
        }}
      >
        <span className="label-caps">
          {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
        </span>
        <Link
          href={`/trips/${tripId}/suggest`}
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "var(--text-xs)",
            letterSpacing: "0.04em",
            color: "#fff",
            backgroundColor: "var(--sea)",
            border: "none",
            padding: "var(--space-2) var(--space-4)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            minHeight: "44px",
          }}
        >
          Suggest changes
        </Link>
      </div>

      {proposals.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "var(--space-16) var(--space-6)",
          }}
        >
          <p
            className="font-display"
            style={{
              fontSize: "var(--text-xl)",
              fontStyle: "italic",
              color: "var(--text-soft)",
              margin: "0 0 var(--space-2) 0",
            }}
          >
            No proposals yet
          </p>
          <p style={{ color: "var(--text-soft)", margin: 0 }}>
            Suggest changes to this trip and let the captain decide.
          </p>
        </div>
      )}

      {open.length > 0 && (
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h3 className="label-caps" style={{ marginBottom: "var(--space-4)" }}>
            Open
          </h3>
          {open.map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </section>
      )}

      {closed.length > 0 && (
        <section>
          <h3 className="label-caps" style={{ marginBottom: "var(--space-4)" }}>
            Resolved
          </h3>
          {closed.map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </section>
      )}
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: ProposalSummary }) {
  const statusConfig: Record<
    ProposalStatus,
    { label: string; color: string }
  > = {
    OPEN: { label: "Open", color: "var(--sea)" },
    MERGED: { label: "Merged", color: "var(--moss)" },
    REJECTED: { label: "Rejected", color: "var(--clay)" },
    WITHDRAWN: { label: "Withdrawn", color: "var(--text-soft)" },
    CONFLICTED: { label: "Conflicted", color: "var(--sun)" },
  };

  const sc = statusConfig[proposal.status];

  return (
    <Link
      href={`/trips/${proposal.tripId}/proposals/${proposal.id}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        border: "1px solid var(--border)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-3)",
        transition: "border-color var(--duration-fast) var(--ease-out)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <MemberAvatar
          name={proposal.author.name}
          photoKey={proposal.author.photoKey}
          size={32}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {proposal.title}
            </span>
            <span
              className="font-mono-ft"
              style={{
                fontSize: "var(--text-xs)",
                color: sc.color,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {sc.label}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--space-4)",
              marginTop: "var(--space-1)",
              fontSize: "var(--text-xs)",
              color: "var(--text-soft)",
            }}
          >
            <span>{proposal.author.name}</span>
            <span>
              {proposal._count.changes} change
              {proposal._count.changes !== 1 ? "s" : ""}
            </span>
            {proposal._count.supporters > 0 && (
              <span>
                +{proposal._count.supporters} support
                {proposal._count.supporters !== 1 ? "s" : ""}
              </span>
            )}
            <span>
              {new Date(proposal.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
