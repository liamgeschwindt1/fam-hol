"use client";

import dynamic from "next/dynamic";

export const TripMap = dynamic(
  () => import("./TripMap").then((module) => module.TripMap),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          minHeight: "400px",
          display: "grid",
          placeItems: "center",
          background: "var(--paper-2)",
        }}
      >
        Loading map...
      </div>
    ),
  },
);
