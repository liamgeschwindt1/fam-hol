import Link from "next/link";

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "calc(100dvh - 56px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-12) var(--space-6)",
        textAlign: "center",
      }}
    >
      <p
        className="label-caps"
        style={{ marginBottom: "var(--space-4)", color: "var(--sea)" }}
      >
        Private family travel
      </p>

      <h1
        className="font-display"
        style={{
          fontSize: "clamp(var(--text-3xl), 8vw, var(--text-5xl))",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          margin: "0 0 var(--space-6)",
          maxWidth: "16ch",
        }}
      >
        Plan trips together,{" "}
        <em style={{ color: "var(--sea)" }}>beautifully</em>.
      </h1>

      <p
        style={{
          fontSize: "var(--text-lg)",
          color: "var(--text-soft)",
          maxWidth: "42ch",
          margin: "0 0 var(--space-8)",
          lineHeight: 1.6,
        }}
      >
        One place for the whole family to suggest trips, vote on
        accommodation, split costs fairly, and keep everyone in sync.
      </p>

      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link
          href="/join"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: "44px",
            padding: "0 var(--space-6)",
            backgroundColor: "var(--sea)",
            color: "#fff",
            borderRadius: "4px",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            textDecoration: "none",
            transition:
              "background-color var(--duration-fast) var(--ease-out)",
          }}
        >
          Join the family
        </Link>
        <Link
          href="/trips"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: "44px",
            padding: "0 var(--space-6)",
            backgroundColor: "transparent",
            color: "var(--ink)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Browse trips
        </Link>
      </div>

      {/* Setup notice — shown until M1 is done */}
      <p
        style={{
          marginTop: "var(--space-16)",
          fontSize: "var(--text-xs)",
          color: "var(--text-soft)",
          fontFamily: "var(--font-dm-mono)",
        }}
      >
        First time?{" "}
        <Link href="/setup" style={{ color: "var(--sea)" }}>
          Set up the family space →
        </Link>
      </p>
    </div>
  );
}
