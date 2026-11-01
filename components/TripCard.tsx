"use client";

import Link from "next/link";
import type { Season, TripStatus } from "@prisma/client";
import { SeasonChip } from "@/components/SeasonChip";
import { StatusBadge } from "@/components/StatusBadge";
import { MemberAvatar } from "@/components/MemberAvatar";
import { useMemo } from "react";

interface TripCardProps {
  id: string;
  title: string;
  coverUrl: string | null;
  season: Season;
  status: TripStatus;
  startDate: string;
  endDate: string;
  captain: { name: string; photoKey: string | null };
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const startStr = s.toLocaleDateString("en-GB", opts);
  const endStr = e.toLocaleDateString("en-GB", {
    ...opts,
    year: "numeric",
  });

  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${endStr}`;
  }
  return `${startStr} – ${endStr}`;
}

export function TripCard({
  id,
  title,
  coverUrl,
  season,
  status,
  startDate,
  endDate,
  captain,
}: TripCardProps) {
  const rotation = useMemo(
    () => (Math.random() - 0.5) * 2.4,
    [],
  );

  return (
    <Link
      href={`/trips/${id}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        transition: "transform var(--duration-base) var(--ease-out)",
      }}
      onMouseEnter={(e) => {
        if (window.matchMedia("(pointer: fine)").matches) {
          e.currentTarget.style.transform = `rotate(${rotation}deg)`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "rotate(0deg)";
      }}
    >
      {/* Polaroid frame */}
      <div
        style={{
          backgroundColor: "var(--paper)",
          border: "1px solid var(--border)",
          padding: "6px 6px 0 6px",
        }}
      >
        {/* Image area */}
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            backgroundColor: "var(--paper-2)",
            overflow: "hidden",
            position: "relative",
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
                opacity: 0.4,
              }}
            >
              No photo yet
            </div>
          )}
          {/* Status badge overlay */}
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <StatusBadge status={status} />
          </div>
        </div>

        {/* Paper strip below image */}
        <div style={{ padding: "12px 6px 14px 6px" }}>
          <h3
            style={{
              fontFamily: "var(--font-instrument)",
              fontSize: "var(--text-xl)",
              fontWeight: 400,
              margin: 0,
              lineHeight: 1.2,
              color: "var(--ink)",
            }}
          >
            {title}
          </h3>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginTop: "var(--space-2)",
              flexWrap: "wrap",
            }}
          >
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

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginTop: "var(--space-3)",
            }}
          >
            <MemberAvatar
              name={captain.name}
              photoKey={captain.photoKey}
              size={24}
            />
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-soft)",
              }}
            >
              {captain.name}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
