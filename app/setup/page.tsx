import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your family space" };

export default async function SetupPage() {
  const existing = await db.family.findFirst();
  if (existing) {
    const { member } = await requireMember();
    redirect(member.isAdmin ? "/admin" : "/trips");
  }

  return (
    <div className="setup-shell">
      <aside className="setup-story">
        <span className="home-badge">Good times start with your people</span>
        <h2 className="font-display">One family.<br /><em>Endless adventures.</em></h2>
        <p>A cosy little corner of the internet for your favourite people and the places you&apos;ll go together.</p>
        <ol className="setup-steps">
          <li><span>01</span> Create your family space</li>
          <li><span>02</span> Invite everyone along</li>
          <li><span>03</span> Plan something worth remembering</li>
        </ol>
      </aside>
      <div className="setup-panel">
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
