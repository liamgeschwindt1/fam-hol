import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { GroupInvites } from "./GroupInvites";
import { MemberAvatar } from "@/components/MemberAvatar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your group" };

export default async function GroupsPage() {
  const { member, family } = await requireMember();
  const members = await db.member.findMany({
      where: { familyId: family.id, isDependent: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, photoKey: true, isAdmin: true },
    });

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
            <MemberAvatar name={person.name} photoKey={person.photoKey} size={38} />
            <span>{person.name}{person.id === member.id ? " (you)" : ""}</span>
            {person.isAdmin && <span className="label-caps">Admin</span>}
          </div>
        ))}
      </section>

      <GroupInvites groupName={family.name} />
    </div>
  );
}
