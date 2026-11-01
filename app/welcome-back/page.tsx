import { db } from "@/lib/db";
import MemberGrid from "./MemberGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Who are you?" };

export default async function WelcomeBackPage() {
  const members = await db.member.findMany({
    where: { isDependent: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      photoKey: true,
      pinHash: true,
    },
  });

  const family = await db.family.findFirst({
    select: { name: true },
  });

  if (!family) {
    // No family set up yet — redirect to setup
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
        <h1
          className="font-display"
          style={{
            fontSize: "var(--text-2xl)",
            color: "var(--ink)",
            margin: "0 0 var(--space-4)",
          }}
        >
          No family set up yet
        </h1>
        <p style={{ color: "var(--text-soft)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-6)" }}>
          Set up your family space to get started.
        </p>
        <a
          href="/setup"
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
          }}
        >
          Set up family space
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "calc(100dvh - 56px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "600px" }}>
        <p
          className="label-caps"
          style={{ marginBottom: "var(--space-3)", color: "var(--sea)", textAlign: "center" }}
        >
          {family.name}
        </p>
        <h1
          className="font-display"
          style={{
            fontSize: "var(--text-3xl)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            margin: "0 0 var(--space-8)",
            textAlign: "center",
          }}
        >
          Who are you?
        </h1>

        {members.length === 0 ? (
          <p style={{ color: "var(--text-soft)", textAlign: "center" }}>
            No members yet. Ask your admin for an invite link.
          </p>
        ) : (
          <MemberGrid
            members={members.map((m) => ({
              id: m.id,
              name: m.name,
              photoKey: m.photoKey,
              hasPin: !!m.pinHash,
            }))}
          />
        )}
      </div>
    </div>
  );
}
