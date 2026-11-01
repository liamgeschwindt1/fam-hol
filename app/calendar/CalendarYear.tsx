"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Season } from "@prisma/client";

const SEASON_HEX: Record<Season, string> = {
  SNOW: "var(--season-snow)",
  SURF: "var(--season-surf)",
  EASTER: "var(--season-easter)",
  CHRISTMAS: "var(--season-christmas)",
  NYE: "var(--season-nye)",
  SUMMER: "var(--season-summer)",
  CITY: "var(--season-city)",
  OTHER: "var(--text-soft)",
};

export interface YearTrip {
  id: string;
  title: string;
  season: Season;
  startDate: string;
  endDate: string;
}

interface CalendarYearProps {
  trips: YearTrip[];
  year: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarYear({ trips, year }: CalendarYearProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Index trip seasons by date
  const tripsByDate = new Map<string, Season[]>();
  for (const trip of trips) {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const cur = new Date(start);
    while (cur <= end) {
      if (cur.getFullYear() === year) {
        const key = dateKey(cur);
        const arr = tripsByDate.get(key) ?? [];
        arr.push(trip.season);
        tripsByDate.set(key, arr);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const today = new Date();

  function navYear(dir: -1 | 1) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "year");
    p.set("y", String(year + dir));
    router.push(`/calendar?${p.toString()}`);
  }

  function goToMonth(month: number) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "month");
    p.set("y", String(year));
    p.set("m", String(month));
    router.push(`/calendar?${p.toString()}`);
  }

  return (
    <div>
      {/* Year nav */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <button
          onClick={() => navYear(-1)}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "2px",
            padding: "6px 12px",
            cursor: "pointer",
            color: "var(--text)",
            fontFamily: "var(--font-hanken)",
            fontSize: "var(--text-sm)",
          }}
        >
          &larr;
        </button>
        <h2
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-2xl)",
            fontWeight: 400,
            margin: 0,
            color: "var(--ink)",
          }}
        >
          {year}
        </h2>
        <button
          onClick={() => navYear(1)}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "2px",
            padding: "6px 12px",
            cursor: "pointer",
            color: "var(--text)",
            fontFamily: "var(--font-hanken)",
            fontSize: "var(--text-sm)",
          }}
        >
          &rarr;
        </button>
      </div>

      {/* 12-month grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "var(--space-6)",
        }}
      >
        {Array.from({ length: 12 }, (_, month) => {
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          const startDow = (firstDay.getDay() + 6) % 7;
          const totalDays = lastDay.getDate();

          const cells: (number | null)[] = [];
          for (let i = 0; i < startDow; i++) cells.push(null);
          for (let d = 1; d <= totalDays; d++) cells.push(d);
          while (cells.length % 7 !== 0) cells.push(null);

          return (
            <div key={month}>
              <button
                onClick={() => goToMonth(month)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-instrument)",
                  fontSize: "var(--text-lg)",
                  fontWeight: 400,
                  color: "var(--ink)",
                  padding: "0 0 var(--space-2) 0",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {MONTH_NAMES[month]}
              </button>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "1px",
                }}
              >
                {DAY_HEADERS.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "9px",
                      fontFamily: "var(--font-dm-mono)",
                      color: "var(--text-soft)",
                      textAlign: "center",
                      padding: "2px 0",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  const isToday =
                    day != null &&
                    today.getFullYear() === year &&
                    today.getMonth() === month &&
                    today.getDate() === day;
                  const key = day != null ? dateKey(new Date(year, month, day)) : "";
                  const seasons = day != null ? (tripsByDate.get(key) ?? []) : [];
                  const uniqueSeasons = [...new Set(seasons)];

                  return (
                    <div
                      key={i}
                      style={{
                        textAlign: "center",
                        fontSize: "10px",
                        fontFamily: "var(--font-dm-mono)",
                        color: isToday ? "var(--sea)" : day != null ? "var(--text-soft)" : "transparent",
                        fontWeight: isToday ? 700 : 400,
                        padding: "2px 0 4px 0",
                        position: "relative",
                      }}
                    >
                      {day ?? ""}
                      {uniqueSeasons.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "1px",
                            marginTop: "1px",
                          }}
                        >
                          {uniqueSeasons.slice(0, 3).map((s, si) => (
                            <div
                              key={si}
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: "50%",
                                backgroundColor: SEASON_HEX[s],
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
