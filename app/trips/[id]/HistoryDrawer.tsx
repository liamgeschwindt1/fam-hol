"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MemberAvatar } from "@/components/MemberAvatar";
import { restoreRevision } from "./history-actions";
import Link from "next/link";

interface RevisionData {
  id: string;
  revision: number;
  summary: string;
  createdAt: string;
  actor: { name: string; photoKey: string | null };
  proposalId: string | null;
  snapshotJson: unknown;
}

interface HistoryDrawerProps {
  tripId: string;
  revisions: RevisionData[];
  isCaptain: boolean;
  open: boolean;
  onClose: () => void;
}

export function HistoryDrawer({
  tripId,
  revisions,
  isCaptain,
  open,
  onClose,
}: HistoryDrawerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [viewingSnapshot, setViewingSnapshot] = useState<string | null>(null);

  if (!open) return null;

  const handleRestore = (revisionId: string) => {
    if (!confirm("Restore this revision? This will overwrite current trip data.")) return;

    startTransition(async () => {
      await restoreRevision(tripId, revisionId);
      router.refresh();
      onClose();
    });
  };

  const viewedRevision = viewingSnapshot
    ? revisions.find((r) => r.id === viewingSnapshot) ?? null
    : null;
  const snapshot = viewedRevision
    ? (viewedRevision.snapshotJson as Record<string, unknown>)
    : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.3)",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "var(--paper)",
          borderLeft: "1px solid var(--border)",
          overflowY: "auto",
          padding: "var(--space-6)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-6)",
          }}
        >
          <h2
            className="font-display"
            style={{ fontSize: "var(--text-xl)", margin: 0 }}
          >
            {viewingSnapshot ? "Revision snapshot" : "History"}
          </h2>
          <button
            onClick={viewingSnapshot ? () => setViewingSnapshot(null) : onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-soft)",
              cursor: "pointer",
              fontSize: "var(--text-lg)",
              minWidth: "44px",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {viewingSnapshot ? "←" : "✕"}
          </button>
        </div>

        {viewedRevision && snapshot ? (
          <div>
            <div className="label-caps" style={{ marginBottom: "var(--space-2)" }}>
              Revision {viewedRevision.revision}
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-soft)", marginBottom: "var(--space-4)" }}>
              {viewedRevision.summary}
            </div>

            {/* Snapshot fields */}
            {renderSnapshotFields(snapshot)}

            {isCaptain && (
              <button
                onClick={() => handleRestore(viewedRevision.id)}
                disabled={isPending}
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "var(--text-sm)",
                  letterSpacing: "0.04em",
                  color: "#fff",
                  backgroundColor: "var(--sea)",
                  border: "none",
                  padding: "var(--space-3) var(--space-6)",
                  cursor: "pointer",
                  minHeight: "44px",
                  marginTop: "var(--space-6)",
                  opacity: isPending ? 0.5 : 1,
                  width: "100%",
                }}
              >
                {isPending ? "Restoring..." : "Restore this revision"}
              </button>
            )}
          </div>
        ) : (
          <div>
            {revisions.length === 0 && (
              <p style={{ color: "var(--text-soft)", fontStyle: "italic" }}>
                No revisions recorded yet.
              </p>
            )}

            {revisions.map((rev) => (
              <div
                key={rev.id}
                style={{
                  padding: "var(--space-3) 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  <MemberAvatar
                    name={rev.actor.name}
                    photoKey={rev.actor.photoKey}
                    size={24}
                  />
                  <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                    {rev.actor.name}
                  </span>
                  <span
                    className="font-mono-ft"
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-soft)",
                    }}
                  >
                    rev {rev.revision}
                  </span>
                </div>

                <p
                  style={{
                    margin: "0 0 var(--space-2) 0",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-soft)",
                  }}
                >
                  {rev.summary}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-3)",
                    alignItems: "center",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-soft)",
                  }}
                >
                  <span>
                    {new Date(rev.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  <button
                    onClick={() => setViewingSnapshot(rev.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--sea)",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                      padding: "var(--space-1) var(--space-2)",
                      minHeight: "44px",
                    }}
                  >
                    View snapshot
                  </button>

                  {rev.proposalId && (
                    <Link
                      href={`/trips/${tripId}/proposals/${rev.proposalId}`}
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--sea)",
                      }}
                    >
                      View proposal
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderSnapshotFields(snapshot: Record<string, unknown>) {
  const display: { label: string; value: string }[] = [];

  if (snapshot.title) display.push({ label: "Title", value: String(snapshot.title) });
  if (snapshot.tagline) display.push({ label: "Tagline", value: String(snapshot.tagline) });
  if (snapshot.descriptionMd) display.push({ label: "Description", value: String(snapshot.descriptionMd) });
  if (snapshot.season) display.push({ label: "Season", value: String(snapshot.season) });
  if (snapshot.startDate) display.push({ label: "Start date", value: String(snapshot.startDate).split("T")[0] ?? "" });
  if (snapshot.endDate) display.push({ label: "End date", value: String(snapshot.endDate).split("T")[0] ?? "" });
  if (snapshot.status) display.push({ label: "Status", value: String(snapshot.status) });

  return (
    <div>
      {display.map((d) => (
        <div key={d.label} style={{ marginBottom: "var(--space-3)" }}>
          <span className="label-caps" style={{ display: "block", marginBottom: "var(--space-1)" }}>
            {d.label}
          </span>
          <span style={{ fontSize: "var(--text-sm)" }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}
