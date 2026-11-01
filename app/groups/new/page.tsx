import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { CreateGroupForm } from "./CreateGroupForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create a group" };

export default async function CreateGroupPage() {
  const { member } = await requireMember();
  if (!member.userAccountId) redirect("/me?link-email=1");

  return (
    <div className="setup-shell">
      <section className="setup-story">
        <span className="home-badge">Bring another circle together</span>
        <h1 className="font-display">
          A new group.<br /><em>More adventures.</em>
        </h1>
        <p>Create a group and invite people to plan trips together.</p>
      </section>
      <div className="setup-panel">
        <CreateGroupForm memberName={member.name} />
      </div>
    </div>
  );
}
