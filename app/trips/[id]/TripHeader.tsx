import type { Season, TripStatus } from "@prisma/client";
import { MemberAvatar } from "@/components/MemberAvatar";
import { SeasonChip } from "@/components/SeasonChip";
import { StatusBadge } from "@/components/StatusBadge";

const S3_BASE = process.env.NEXT_PUBLIC_S3_BASE_URL ?? "";

interface TripHeaderProps {
  title: string;
  tagline: string | null;
  coverStorageKey: string | null;
  season: Season;
  status: TripStatus;
  startDate: Date | null;
  endDate: Date | null;
  captain: { name: string; photoKey: string | null };
}

function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start || !end) return "Dates to be decided";
  const opts: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
  };
  const startStr = start.toLocaleDateString("en-GB", opts);
  const endStr = end.toLocaleDateString("en-GB", {
    ...opts,
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

export function TripHeader({
  title,
  tagline,
  coverStorageKey,
  season,
  status,
  startDate,
  endDate,
  captain,
}: TripHeaderProps) {
  const coverUrl =
    coverStorageKey && S3_BASE ? `${S3_BASE}/${coverStorageKey}` : null;

  return (
    <header>
      {/* Cover image */}
      <div
        style={{
          width: "100%",
          height: "clamp(200px, 40vw, 400px)",
          backgroundColor: coverUrl ? undefined : "var(--paper-2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-soft)",
              fontFamily: "var(--font-instrument)",
              fontSize: "var(--text-2xl)",
              fontStyle: "italic",
              opacity: 0.3,
            }}
          >
            No cover photo
          </div>
        )}
      </div>

      {/* Title strip overlapping the image edge */}
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 var(--space-6)",
          position: "relative",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--paper)",
            display: "inline-block",
            padding: "var(--space-4) var(--space-6) var(--space-3) 0",
            marginTop: "-28px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-instrument)",
              fontSize: "clamp(var(--text-2xl), 5vw, var(--text-3xl))",
              fontWeight: 400,
              margin: 0,
              lineHeight: 1.1,
              color: "var(--ink)",
            }}
          >
            {title}
          </h1>

          {tagline && (
            <p
              style={{
                margin: "var(--space-1) 0 0 0",
                fontSize: "var(--text-lg)",
                color: "var(--text-soft)",
                fontStyle: "italic",
              }}
            >
              {tagline}
            </p>
          )}
        </div>

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flexWrap: "wrap",
            marginTop: "var(--space-3)",
            paddingBottom: "var(--space-4)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {/* Captain */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <div
              style={{
                position: "relative",
                display: "inline-flex",
              }}
            >
              <MemberAvatar
                name={captain.name}
                photoKey={captain.photoKey}
                size={28}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -1,
                  right: -1,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: "var(--clay)",
                  border: "2px solid var(--paper)",
                }}
              />
            </div>
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-soft)",
              }}
            >
              Captained by {captain.name}
            </span>
          </div>

          <StatusBadge status={status} />
          <SeasonChip season={season} />

          <span
            style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--text-soft)",
              letterSpacing: "0.04em",
            }}
          >
            {formatDateRange(startDate, endDate)}
          </span>
        </div>
      </div>
    </header>
  );
}
