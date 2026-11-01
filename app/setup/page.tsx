import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SetupForm from "./SetupForm";

export const metadata = { title: "Set up your family space" };

export default async function SetupPage() {
  // If a family already exists, send to home
  const existing = await db.family.findFirst();
  if (existing) {
    redirect("/");
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
          First time setup
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
          Create your family space
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-soft)",
            margin: "0 0 var(--space-8)",
          }}
        >
          You&apos;ll be the admin. Everyone else joins via invite link.
        </p>

        <SetupForm />
      </div>
    </div>
  );
}
