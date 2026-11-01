import type { Season } from "@prisma/client";

const SEASON_LABELS: Record<Season, string> = {
  SNOW: "Snow",
  SURF: "Surf",
  EASTER: "Easter",
  CHRISTMAS: "Christmas",
  NYE: "NYE",
  SUMMER: "Summer",
  CITY: "City",
  OTHER: "Other",
};

const SEASON_COLORS: Record<Season, string> = {
  SNOW: "var(--season-snow)",
  SURF: "var(--season-surf)",
  EASTER: "var(--season-easter)",
  CHRISTMAS: "var(--season-christmas)",
  NYE: "var(--season-nye)",
  SUMMER: "var(--season-summer)",
  CITY: "var(--season-city)",
  OTHER: "var(--text-soft)",
};

export function SeasonChip({ season }: { season: Season }) {
  const color = SEASON_COLORS[season];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        fontFamily: "var(--font-dm-mono)",
        fontSize: "var(--text-xs)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
        border: `1px solid ${color}`,
        borderRadius: "2px",
        padding: "2px 8px",
        lineHeight: 1.4,
      }}
    >
      {SEASON_LABELS[season]}
    </span>
  );
}
