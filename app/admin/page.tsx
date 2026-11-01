import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import AdminClient from "./AdminClient";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const { member, family } = await requireMember();

  if (!member.isAdmin) {
    redirect("/");
  }

  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";

  const [members, households, deviceRequests] = await Promise.all([
    db.member.findMany({
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
    }),
    db.household.findMany({
      where: { familyId: family.id },
      orderBy: { name: "asc" },
    }),
    db.deviceRequest.findMany({
      where: { status: "PENDING", member: { familyId: family.id } },
      include: { member: { select: { id: true, name: true, photoKey: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Build invite URL from raw token (we only store hash, so generate fresh URL for display)
  // Actually, we store the hash. The admin needs to regenerate to get a new URL.
  // For now, show the family invite hash hint and let admin regenerate.
  // We'll display a "Regenerate" button and show the URL from the stored hash if we can't reverse it.
  // Since we can't reverse the hash, we store the last raw token in a separate field.
  // SIMPLE APPROACH: show that an invite link exists, allow regeneration which will display the new URL.
  // After regeneration, the server redirects to /admin which re-renders with the new hash.
  // We need to persist the raw token temporarily — but that's a security concern.
  // Better approach: redirect to /admin?invite=<rawToken> after regeneration.
  // For now: show a "Copy invite link" button that regenerates and shows the link.

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
