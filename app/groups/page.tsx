import { headers } from "next/headers";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { GroupInvites } from "./GroupInvites";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your group" };

export default async function GroupsPage() {
  const { member, family } = await requireMember();
  const [members, headerStore] = await Promise.all([
    db.member.findMany({
      where: { familyId: family.id, isDependent: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isAdmin: true },
    }),
    headers(),
  ]);
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const baseUrl = process.env.APP_URL ?? `${protocol}://${host}`;

  return (
    <div className="groups-page">
      <header className="groups-heading">
        <div>
          <span className="label-caps">Your people, your plans</span>
          <h1 className="font-display">{family.name}</h1>
          <p>{members.length} group {members.length === 1 ? "member" : "members"}</p>
        </div>
        <Link href="/groups/new" className="action-secondary">Create another group</Link>
      </header>

      <section className="group-member-list" aria-label="Group members">
        {members.map((person) => (
          <div key={person.id} className="group-member-row">
            <span className="group-member-avatar">{person.name.charAt(0).toUpperCase()}</span>
            <span>{person.name}{person.id === member.id ? " (you)" : ""}</span>
            {person.isAdmin && <span className="label-caps">Admin</span>}
          </div>
        ))}
      </section>

      <GroupInvites baseUrl={baseUrl} />
    </div>
  );
}
