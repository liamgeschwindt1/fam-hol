import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import MemberGrid from "./MemberGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Who are you?" };

export default async function WelcomeBackPage() {
  const family = await db.family.findFirst({
    select: { name: true },
  });

  if (!family) {
    redirect("/setup");
  }

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
