import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth";
import JoinForm from "./JoinForm";

export const metadata = { title: "Join the family" };

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;

  const tokenHash = hashToken(token);
  const family = await db.family.findFirst({
    where: { inviteTokenHash: tokenHash },
    include: {
      households: { orderBy: { name: "asc" } },
    },
  });

  if (!family) {
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
          Invalid invite link
        </h1>
        <p style={{ color: "var(--text-soft)", fontSize: "var(--text-sm)" }}>
          This link may have expired or been regenerated. Ask your family admin
          for a fresh one.
        </p>
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
        justifyContent: "center",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <p
          className="label-caps"
          style={{ marginBottom: "var(--space-3)", color: "var(--sea)" }}
        >
          You&apos;re invited
        </p>
        <h1
          className="font-display"
          style={{
            fontSize: "var(--text-3xl)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            margin: "0 0 var(--space-2)",
          }}
        >
          Join {family.name}
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-soft)",
            margin: "0 0 var(--space-8)",
          }}
        >
          Fill in your details to join the family trip planner.
        </p>

        <JoinForm
          token={token}
          households={family.households.map((h) => ({
            id: h.id,
            name: h.name,
          }))}
        />
      </div>
    </div>
  );
}
