import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const { member, family } = await requireMember();

  if (!member.isAdmin) {
    redirect("/");
  }

  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";

  const members = await db.member.findMany({
    where: { familyId: family.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      photoKey: true,
      isAdmin: true,
      isDependent: true,
      household: { select: { id: true, name: true } },
    },
  });

  const households = await db.household.findMany({
    where: { familyId: family.id },
    orderBy: { name: "asc" },
  });

  const deviceRequests = await db.deviceRequest.findMany({
    where: { status: "PENDING", member: { familyId: family.id } },
    include: { member: { select: { id: true, name: true, photoKey: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AdminClient
      currentMemberId={member.id}
      family={{ id: family.id, name: family.name }}
      baseUrl={`${proto}://${host}`}
      members={members.map((m) => ({
        id: m.id,
        name: m.name,
        photoKey: m.photoKey,
        isAdmin: m.isAdmin,
        isDependent: m.isDependent,
        householdName: m.household?.name ?? null,
      }))}
      households={households.map((h) => ({ id: h.id, name: h.name }))}
      pendingRequests={deviceRequests.map((r) => ({
        id: r.id,
        member: {
          id: r.member.id,
          name: r.member.name,
          photoKey: r.member.photoKey,
        },
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
