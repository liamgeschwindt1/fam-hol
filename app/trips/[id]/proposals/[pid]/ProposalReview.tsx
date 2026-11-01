"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DiffView } from "@/components/DiffView";
import { MemberAvatar } from "@/components/MemberAvatar";
import { mergeProposal, rejectProposal, supportProposal } from "./actions";
import type { ChangeState, ChangeType, ProposalStatus } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────

interface ChangeData {
  id: string;
  type: ChangeType;
  targetId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  state: ChangeState;
}

interface SupportData {
  memberId: string;
  member: { name: string; photoKey: string | null };
}

interface ProposalViewData {
  id: string;
  tripId: string;
  title: string;
  descriptionMd: string | null;
  status: ProposalStatus;
  baseRevision: number;
  rejectReason: string | null;
  createdAt: string;
  author: { id: string; name: string; photoKey: string | null };
  mergedBy: { name: string } | null;
  mergedAt: string | null;
  changes: ChangeData[];
  supporters: SupportData[];
}

interface ProposalReviewProps {
  proposal: ProposalViewData;
  isCaptain: boolean;
  currentMemberId: string;
}

export function ProposalReview({
  proposal,
  isCaptain,
  currentMemberId,
}: ProposalReviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(
    new Set(proposal.changes.map((c) => c.id)),
  );
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isOpen = proposal.status === "OPEN";
  const isAuthor = proposal.author.id === currentMemberId;
  const hasSupported = proposal.supporters.some(
    (s) => s.memberId === currentMemberId,
  );

  const toggleChange = (id: string) => {
    setSelectedChanges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedChanges.size === proposal.changes.length) {
      setSelectedChanges(new Set());
    } else {
      setSelectedChanges(new Set(proposal.changes.map((c) => c.id)));
    }
  };

  const handleMerge = () => {
    startTransition(async () => {
      await mergeProposal(proposal.id, Array.from(selectedChanges));
      router.refresh();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await rejectProposal(proposal.id, rejectReason);
      setShowRejectModal(false);
      router.refresh();
    });
  };

  const handleSupport = () => {
    startTransition(async () => {
      await supportProposal(proposal.id);
      router.refresh();
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <MemberAvatar
            name={proposal.author.name}
            photoKey={proposal.author.photoKey}
            size={36}
          />
          <div>
            <span style={{ fontWeight: 600 }}>{proposal.author.name}</span>
            <span style={{ color: "var(--text-soft)", marginLeft: "var(--space-2)", fontSize: "var(--text-sm)" }}>
              {new Date(proposal.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <ProposalStatusBadge status={proposal.status} />

        {proposal.descriptionMd && (
          <p
            style={{
              color: "var(--text-soft)",
              margin: "var(--space-4) 0 0 0",
              fontFamily: "var(--font-instrument), Georgia, serif",
              fontSize: "var(--text-base)",
              lineHeight: 1.6,
            }}
          >
            {proposal.descriptionMd}
          </p>
        )}

        {proposal.status === "REJECTED" && proposal.rejectReason && (
          <div
            style={{
              marginTop: "var(--space-4)",
              padding: "var(--space-4)",
              backgroundColor: "color-mix(in srgb, var(--clay) 8%, transparent)",
              borderLeft: "3px solid var(--clay)",
            }}
          >
            <span className="label-caps" style={{ display: "block", marginBottom: "var(--space-1)" }}>
              Reason for rejection
            </span>
            <p style={{ margin: 0, color: "var(--ink)" }}>{proposal.rejectReason}</p>
          </div>
        )}

        {proposal.status === "MERGED" && proposal.mergedBy && (
          <p style={{ color: "var(--moss)", fontSize: "var(--text-sm)", margin: "var(--space-3) 0 0 0" }}>
            Merged by {proposal.mergedBy.name}
            {proposal.mergedAt && (
              <>
                {" on "}
                {new Date(proposal.mergedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </>
            )}
          </p>
        )}
      </div>

      {/* Support */}
      <div style={{ marginBottom: "var(--space-6)", display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        {isOpen && !isAuthor && !isCaptain && (
          <button
            onClick={handleSupport}
            disabled={isPending}
            style={{
              ...smallBtnStyle,
              color: hasSupported ? "var(--moss)" : "var(--sea)",
              borderColor: hasSupported ? "var(--moss)" : "var(--border)",
            }}
          >
            {hasSupported ? "+1 (supported)" : "+1 Support"}
          </button>
        )}

        {proposal.supporters.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span className="label-caps">Supporters:</span>
            {proposal.supporters.map((s) => (
              <MemberAvatar
                key={s.memberId}
                name={s.member.name}
                photoKey={s.member.photoKey}
                size={24}
              />
            ))}
          </div>
        )}
      </div>

      <hr />

      {/* Changes */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <span className="label-caps">
            {proposal.changes.length} change{proposal.changes.length !== 1 ? "s" : ""}
          </span>
          {isOpen && isCaptain && (
            <button onClick={toggleAll} style={smallBtnStyle}>
              {selectedChanges.size === proposal.changes.length
                ? "Deselect all"
                : "Select all"}
            </button>
          )}
        </div>

        {proposal.changes.map((change) => (
          <ChangeCard
            key={change.id}
            change={change}
            isCaptain={isCaptain}
            isOpen={isOpen}
            selected={selectedChanges.has(change.id)}
            onToggle={() => toggleChange(change.id)}
          />
        ))}
      </div>

      {/* Captain controls */}
      {isOpen && isCaptain && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "var(--space-6)",
            display: "flex",
            gap: "var(--space-3)",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleMerge}
            disabled={isPending || selectedChanges.size === 0}
            style={{
              ...primaryBtnStyle,
              opacity: isPending || selectedChanges.size === 0 ? 0.5 : 1,
            }}
          >
            {selectedChanges.size === proposal.changes.length
              ? "Merge all"
              : `Merge ${selectedChanges.size} selected`}
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={isPending}
            style={{
              ...smallBtnStyle,
              color: "var(--clay)",
              borderColor: "var(--clay)",
            }}
          >
            Reject
          </button>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "var(--space-4)",
          }}
          onClick={() => setShowRejectModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--paper)",
              border: "1px solid var(--border)",
              padding: "var(--space-8)",
              maxWidth: "480px",
              width: "100%",
            }}
          >
            <h3
              className="font-display"
              style={{
                fontSize: "var(--text-xl)",
                margin: "0 0 var(--space-4) 0",
              }}
            >
              Reject proposal
            </h3>
            <label className="label-caps" style={{ display: "block", marginBottom: "var(--space-2)" }}>
              Reason (required)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this proposal is being rejected"
              style={{ ...inputStyle, marginBottom: "var(--space-4)", resize: "vertical" as const }}
            />
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <button onClick={() => setShowRejectModal(false)} style={smallBtnStyle}>
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || isPending}
                style={{
                  ...primaryBtnStyle,
                  backgroundColor: "var(--clay)",
                  opacity: !rejectReason.trim() || isPending ? 0.5 : 1,
                }}
              >
                {isPending ? "Rejecting..." : "Reject proposal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Change card ─────────────────────────────────────────────────

function ChangeCard({
  change,
  isCaptain,
  isOpen,
  selected,
  onToggle,
}: {
  change: ChangeData;
  isCaptain: boolean;
  isOpen: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const before = change.beforeJson as Record<string, unknown> | null;
  const after = change.afterJson as Record<string, unknown>;

  const stateColor =
    change.state === "MERGED"
      ? "var(--moss)"
      : change.state === "SKIPPED"
        ? "var(--text-soft)"
        : change.state === "CONFLICTED"
          ? "var(--clay)"
          : "var(--ink)";

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-3)",
        opacity: change.state === "SKIPPED" ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        {isOpen && isCaptain && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
        )}

        <div style={{ flex: 1 }}>
          <span
            className="font-mono-ft"
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-soft)",
              marginRight: "var(--space-2)",
            }}
          >
            {formatChangeType(change.type)}
          </span>

          {change.state !== "PENDING" && (
            <span
              className="font-mono-ft"
              style={{
                fontSize: "var(--text-xs)",
                color: stateColor,
                marginLeft: "var(--space-2)",
              }}
            >
              {change.state.toLowerCase()}
            </span>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div style={{ marginTop: "var(--space-3)" }}>
        {renderChangeDiff(change.type, before, after)}
      </div>
    </div>
  );
}

// ─── Diff rendering ──────────────────────────────────────────────

function renderChangeDiff(
  type: ChangeType,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
) {
  switch (type) {
    case "TRIP_FIELD_SET": {
      const field = after.field as string;
      const beforeVal = before?.value as string | undefined;
      const afterVal = after.value as string;
      const label = formatFieldName(field);

      if (
        beforeVal &&
        afterVal &&
        (field === "descriptionMd" || field === "title" || field === "tagline")
      ) {
        return (
          <div>
            <span className="label-caps" style={{ display: "block", marginBottom: "var(--space-2)" }}>
              {label}
            </span>
            <DiffView before={String(beforeVal)} after={String(afterVal)} />
          </div>
        );
      }

      return (
        <div>
          <span className="label-caps">{label}: </span>
          {beforeVal != null && (
            <span style={{ textDecoration: "line-through", color: "var(--clay)" }}>
              {String(beforeVal)}
            </span>
          )}
          {beforeVal != null && afterVal != null && (
            <span style={{ color: "var(--text-soft)", margin: "0 var(--space-2)" }}>&rarr;</span>
          )}
          {afterVal != null && (
            <span style={{ textDecoration: "underline", textDecorationColor: "var(--moss)", color: "var(--moss)" }}>
              {String(afterVal)}
            </span>
          )}
        </div>
      );
    }

    case "DATES_SET": {
      const beforeStart = before?.startDate as string | undefined;
      const beforeEnd = before?.endDate as string | undefined;
      const afterStart = after.startDate as string;
      const afterEnd = after.endDate as string;

      return (
        <div>
          <span className="label-caps" style={{ marginRight: "var(--space-2)" }}>Dates: </span>
          {beforeStart && beforeEnd && (
            <span style={{ textDecoration: "line-through", color: "var(--clay)" }}>
              {beforeStart} to {beforeEnd}
            </span>
          )}
          <span style={{ color: "var(--text-soft)", margin: "0 var(--space-2)" }}>&rarr;</span>
          <span style={{ textDecoration: "underline", textDecorationColor: "var(--moss)", color: "var(--moss)" }}>
            {afterStart} to {afterEnd}
          </span>
        </div>
      );
    }

    case "PROGRAM_ITEM_ADD":
      return (
        <div style={{ color: "var(--moss)" }}>
          <span style={{ textDecoration: "underline", textDecorationColor: "var(--moss)" }}>
            Added: {after.title as string}
          </span>
          {after.date ? (
            <span style={{ color: "var(--text-soft)", marginLeft: "var(--space-2)", fontSize: "var(--text-sm)" }}>
              on {String(after.date)}
            </span>
          ) : null}
          {after.placeName ? (
            <span style={{ color: "var(--text-soft)", marginLeft: "var(--space-2)", fontSize: "var(--text-sm)" }}>
              at {String(after.placeName)}
            </span>
          ) : null}
        </div>
      );

    case "PROGRAM_ITEM_REMOVE":
      return (
        <div style={{ color: "var(--clay)" }}>
          <span style={{ textDecoration: "line-through" }}>
            Removed: {before?.title as string}
          </span>
        </div>
      );

    case "PROGRAM_ITEM_UPDATE": {
      const fields: string[] = [];
      if (before && after) {
        for (const key of ["title", "date", "time", "notes", "placeName"]) {
          const bVal = before[key];
          const aVal = after[key];
          if (bVal !== aVal) {
            fields.push(key);
          }
        }
      }

      return (
        <div>
          {fields.map((f) => (
            <div key={f} style={{ marginBottom: "var(--space-1)" }}>
              <span className="label-caps" style={{ marginRight: "var(--space-2)" }}>
                {formatFieldName(f)}:
              </span>
              {f === "title" || f === "notes" ? (
                <DiffView
                  before={String(before?.[f] ?? "")}
                  after={String(after[f] ?? "")}
                />
              ) : (
                <>
                  <span style={{ textDecoration: "line-through", color: "var(--clay)" }}>
                    {String(before?.[f] ?? "(none)")}
                  </span>
                  <span style={{ color: "var(--text-soft)", margin: "0 var(--space-2)" }}>&rarr;</span>
                  <span style={{ textDecoration: "underline", textDecorationColor: "var(--moss)", color: "var(--moss)" }}>
                    {String(after[f] ?? "(none)")}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      );
    }

    case "STAY_OPTION_ADD":
      return (
        <div style={{ color: "var(--moss)" }}>
          <span style={{ textDecoration: "underline", textDecorationColor: "var(--moss)" }}>
            Added stay: {after.title as string}
          </span>
          {after.priceNote ? (
            <span style={{ color: "var(--text-soft)", marginLeft: "var(--space-2)", fontSize: "var(--text-sm)" }}>
              ({String(after.priceNote)})
            </span>
          ) : null}
        </div>
      );

    case "STAY_OPTION_REMOVE":
      return (
        <div style={{ color: "var(--clay)" }}>
          <span style={{ textDecoration: "line-through" }}>
            Removed stay: {before?.title as string}
          </span>
        </div>
      );

    default:
      return (
        <div style={{ color: "var(--text-soft)", fontSize: "var(--text-sm)" }}>
          {JSON.stringify(after)}
        </div>
      );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatChangeType(type: ChangeType): string {
  return type.replace(/_/g, " ").toLowerCase();
}

function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    title: "Title",
    tagline: "Tagline",
    descriptionMd: "Description",
    season: "Season",
    startDate: "Start date",
    endDate: "End date",
    date: "Date",
    time: "Time",
    notes: "Notes",
    placeName: "Place",
  };
  return map[field] ?? field;
}

function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const config: Record<ProposalStatus, { label: string; bg: string; color: string }> = {
    OPEN: {
      label: "Open",
      bg: "color-mix(in srgb, var(--sea) 15%, transparent)",
      color: "var(--sea)",
    },
    MERGED: {
      label: "Merged",
      bg: "color-mix(in srgb, var(--moss) 15%, transparent)",
      color: "var(--moss)",
    },
    REJECTED: {
      label: "Rejected",
      bg: "color-mix(in srgb, var(--clay) 15%, transparent)",
      color: "var(--clay)",
    },
    WITHDRAWN: {
      label: "Withdrawn",
      bg: "color-mix(in srgb, var(--ink-soft) 15%, transparent)",
      color: "var(--text-soft)",
    },
    CONFLICTED: {
      label: "Conflicted",
      bg: "color-mix(in srgb, var(--sun) 15%, transparent)",
      color: "var(--sun)",
    },
  };

  const c = config[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-dm-mono)",
        fontSize: "var(--text-xs)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: c.color,
        backgroundColor: c.bg,
        borderRadius: "2px",
        padding: "2px 8px",
        lineHeight: 1.4,
      }}
    >
      {c.label}
    </span>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "var(--space-3)",
  fontFamily: "var(--font-hanken), system-ui, sans-serif",
  fontSize: "var(--text-sm)",
  color: "var(--ink)",
  backgroundColor: "var(--paper)",
  border: "1px solid var(--border)",
  minHeight: "44px",
  outline: "none",
};

const smallBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-dm-mono), monospace",
  fontSize: "var(--text-xs)",
  letterSpacing: "0.04em",
  color: "var(--sea)",
  backgroundColor: "transparent",
  border: "1px solid var(--border)",
  padding: "var(--space-2) var(--space-4)",
  cursor: "pointer",
  minHeight: "44px",
};

const primaryBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-dm-mono), monospace",
  fontSize: "var(--text-sm)",
  letterSpacing: "0.04em",
  color: "#fff",
  backgroundColor: "var(--sea)",
  border: "none",
  padding: "var(--space-3) var(--space-6)",
  cursor: "pointer",
  minHeight: "44px",
};
