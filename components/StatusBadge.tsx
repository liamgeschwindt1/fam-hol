import type { TripStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  TripStatus,
  { label: string; bg: string; color: string }
> = {
  IDEA: {
    label: "Idea",
    bg: "color-mix(in srgb, var(--sun) 15%, transparent)",
    color: "var(--sun)",
  },
  PLANNING: {
    label: "Planning",
    bg: "color-mix(in srgb, var(--sea) 15%, transparent)",
    color: "var(--sea)",
  },
  CONFIRMED: {
    label: "Confirmed",
    bg: "color-mix(in srgb, var(--moss) 15%, transparent)",
    color: "var(--moss)",
  },
  HAPPENING: {
    label: "Happening",
    bg: "color-mix(in srgb, var(--clay) 15%, transparent)",
    color: "var(--clay)",
  },
  DONE: {
    label: "Done",
    bg: "color-mix(in srgb, var(--ink-soft) 15%, transparent)",
    color: "var(--text-soft)",
  },
  ARCHIVED: {
    label: "Archived",
    bg: "color-mix(in srgb, var(--ink-soft) 10%, transparent)",
    color: "var(--text-soft)",
  },
};

export function StatusBadge({ status }: { status: TripStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-dm-mono)",
        fontSize: "var(--text-xs)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: config.color,
        backgroundColor: config.bg,
        borderRadius: "2px",
        padding: "2px 8px",
        lineHeight: 1.4,
      }}
    >
      {config.label}
    </span>
  );
}
