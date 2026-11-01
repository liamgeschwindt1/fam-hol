"use client";

import { useState } from "react";
import type { Season, TripStatus } from "@prisma/client";
import { EditTripModal } from "./EditTripModal";
import { advanceStatus } from "./actions";

const STATUS_FLOW: Record<string, string | null> = {
  IDEA: "PLANNING",
  PLANNING: "CONFIRMED",
  CONFIRMED: "HAPPENING",
  HAPPENING: "DONE",
  DONE: "ARCHIVED",
  ARCHIVED: null,
};

const STATUS_ACTION_LABEL: Record<string, string> = {
  IDEA: "Start planning",
  PLANNING: "Confirm trip",
  CONFIRMED: "We're going!",
  HAPPENING: "Mark as done",
  DONE: "Archive",
};

interface TripActionsProps {
  tripId: string;
  status: TripStatus;
  initialData: {
    title: string;
    tagline: string | null;
    description: string;
    startDate: string | null;
    endDate: string | null;
    season: Season;
  };
}

export function TripActions({ tripId, status, initialData }: TripActionsProps) {
  const [showEdit, setShowEdit] = useState(false);
  const nextStatus = STATUS_FLOW[status];
  const actionLabel = STATUS_ACTION_LABEL[status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        marginBottom: "var(--space-4)",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={() => setShowEdit(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: "44px",
          padding: "0 20px",
          fontSize: "var(--text-sm)",
          fontFamily: "var(--font-hanken)",
          fontWeight: 500,
          backgroundColor: "transparent",
          color: "var(--text-soft)",
          border: "1px solid var(--border)",
          borderRadius: "2px",
          cursor: "pointer",
        }}
      >
        Edit
      </button>

      {nextStatus && actionLabel && (
        <form action={advanceStatus}>
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="newStatus" value={nextStatus} />
          <button
            type="submit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "44px",
              padding: "0 20px",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font-hanken)",
              fontWeight: 500,
              backgroundColor: "var(--sea)",
              color: "#fff",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
            }}
          >
            {actionLabel}
          </button>
        </form>
      )}

      {showEdit && (
        <EditTripModal
          tripId={tripId}
          initialData={initialData}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
