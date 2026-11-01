import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { computeCosts } from "@/lib/costs/compute";
import { TripHeader } from "./TripHeader";
import { TripTabs } from "./TripTabs";
import { OverviewTab } from "./OverviewTab";
import { TripActions } from "./TripActions";
import { ChatTab } from "./ChatTab";
import { ProposalsTab } from "./ProposalsTab";
import { CostsTab } from "./CostsTab";
import type { CommentData } from "@/components/CommentThread";
import type { Metadata } from "next";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const trip = await db.trip.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: trip?.title ?? "Trip" };
}

export default async function TripPage({ params, searchParams }: PageProps) {
  const { member, family } = await requireMember();
  const { id } = await params;
  const { tab } = await searchParams;

  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      captain: {
        select: { id: true, name: true, photoKey: true },
      },
      images: {
        orderBy: { sort: "asc" },
        take: 1,
      },
    },
  });

  if (!trip || trip.familyId !== family.id) {
    notFound();
  }

  const activeTab = tab ?? "overview";
  const isCaptain = trip.captainId === member.id;
  const coverStorageKey = trip.images[0]?.storageKey ?? null;

  // Tab-specific data
  let activities: {
    id: string;
    type: string;
    payloadJson: unknown;
    createdAt: Date;
    actor: { name: string; photoKey: string | null };
  }[] = [];

  if (activeTab === "overview") {
    activities = await db.activityLog.findMany({
      where: { tripId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        payloadJson: true,
        createdAt: true,
        actor: { select: { name: true, photoKey: true } },
      },
    });
  }

  // Proposals tab data
  let proposals: {
    id: string;
    tripId: string;
    title: string;
    status: "OPEN" | "MERGED" | "REJECTED" | "WITHDRAWN" | "CONFLICTED";
    createdAt: string;
    author: { name: string; photoKey: string | null };
    _count: { changes: number; supporters: number };
  }[] = [];

  if (activeTab === "proposals") {
    const rawProposals = await db.proposal.findMany({
      where: { tripId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tripId: true,
        title: true,
        status: true,
        createdAt: true,
        author: { select: { name: true, photoKey: true } },
        _count: { select: { changes: true, supporters: true } },
      },
    });
    proposals = rawProposals.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  // Costs tab data
  let costOutput: {
    perMember: {
      memberId: string;
      totalMinor: number;
      byCategory: Record<string, number>;
      byLine: Record<string, number>;
      explain: {
        lineId: string;
        lineLabel: string;
        categoryId: string;
        description: string;
        amountMinor: number;
      }[];
      nights: number;
    }[];
    totals: {
      estimateMinor: number;
      allocatedMinor: number;
      unallocatedMinor: number;
    };
    warnings: string[];
  } | null = null;

  let costCategories: {
    id: string;
    name: string;
    sort: number;
    isAccommodation: boolean;
    lines: {
      id: string;
      label: string;
      amountMinor: number;
      currency: string;
      basis: string;
      unit: string;
      applyAgeWeights: boolean;
      mealsPerDay: number | null;
      note: string | null;
      url: string | null;
    }[];
  }[] = [];

  let costMembers: { id: string; name: string; householdId: string | null; guardianId: string | null }[] = [];
  let costError: string | null = null;
  let costRooms: { id: string; label: string; memberIds: string[] }[] = [];
  let costExpenses: { id: string; paidByMemberId: string; amountMinor: number; currency: string; description: string }[] = [];
  let visibleBankDetails: string | null = null;
  let costPayments: {
    id: string;
    fromMemberId: string;
    amountMinor: number;
    currency: string;
    method: string;
    note: string | null;
    paidOn: string;
    confirmedAt: string | null;
    hasProof: boolean;
  }[] = [];
  let costAdjustments: {
    id: string;
    memberId: string;
    lineId: string | null;
    categoryId: string | null;
    deltaMinor: number | null;
    overrideMinor: number | null;
    reason: string | null;
  }[] = [];

  if (activeTab === "costs") {
    const [cats, familyMembers, payments, adjustments, rooms, expenses, attending] = await Promise.all([
      db.costCategory.findMany({
        where: { tripId: id },
        orderBy: { sort: "asc" },
        include: {
          lines: {
            orderBy: { sort: "asc" },
          },
        },
      }),
      db.member.findMany({
        where: { familyId: family.id },
        select: { id: true, name: true, householdId: true, guardianId: true },
      }),
      db.payment.findMany({
        where: { tripId: id },
        orderBy: { paidOn: "desc" },
      }),
      db.costAdjustment.findMany({
        where: { tripId: id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      db.room.findMany({ where: { tripId: id }, include: { members: true } }),
      db.expense.findMany({ where: { tripId: id }, orderBy: { createdAt: "desc" } }),
      db.attendance.count({ where: { tripId: id, memberId: member.id, status: "IN", date: { gte: trip.startDate, lte: trip.endDate } } }),
    ]);

    costCategories = cats.map((c) => ({
      id: c.id,
      name: c.name,
      sort: c.sort,
      isAccommodation: c.isAccommodation,
      lines: c.lines.map((l) => ({
        id: l.id,
        label: l.label,
        amountMinor: l.amountMinor,
        currency: l.currency,
        basis: l.basis,
        unit: l.unit,
        applyAgeWeights: l.applyAgeWeights,
        mealsPerDay: l.mealsPerDay,
        note: l.note,
        url: l.url,
      })),
    }));

    costMembers = familyMembers;
    costRooms = rooms.map((room) => ({ id: room.id, label: room.label, memberIds: room.members.map((m) => m.memberId) }));
    costExpenses = expenses.map((expense) => ({
      id: expense.id, paidByMemberId: expense.paidByMemberId, amountMinor: expense.amountMinor,
      currency: expense.currency, description: expense.description,
    }));
    visibleBankDetails = isCaptain || (trip.status === "CONFIRMED" && attending > 0) ? trip.bankDetails : null;

    costPayments = payments.map((p) => ({
      id: p.id,
      fromMemberId: p.fromMemberId,
      amountMinor: p.amountMinor,
      currency: p.currency,
      method: p.method,
      note: p.note,
      paidOn: p.paidOn.toISOString().split("T")[0]!,
      confirmedAt: p.confirmedAt?.toISOString() ?? null,
      hasProof: p.proofKey !== null,
    }));

    costAdjustments = adjustments.map((a) => ({
      id: a.id,
      memberId: a.memberId,
      lineId: a.lineId,
      categoryId: a.categoryId,
      deltaMinor: a.deltaMinor,
      overrideMinor: a.overrideMinor,
      reason: a.reason,
    }));

    try {
      costOutput = await computeCosts(id);
    } catch (error) {
      console.error("Trip cost calculation failed", { tripId: id, error });
      costError = "Costs could not be calculated. Check the exchange rates and try again.";
    }
  }

  // Chat tab data
  let chatComments: CommentData[] = [];
  let chatMembers: { id: string; name: string; photoKey: string | null }[] = [];

  if (activeTab === "chat") {
    const familyMembers = await db.member.findMany({
      where: { familyId: family.id },
      select: { id: true, name: true, photoKey: true },
    });
    chatMembers = familyMembers;

    const rawComments = await db.comment.findMany({
      where: {
        tripId: id,
        targetType: "TRIP",
        targetId: id,
        parentId: null,
      },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, photoKey: true } },
        reactions: {
          include: { member: { select: { name: true } } },
        },
      },
    });

    const commentIds = rawComments.map((c) => c.id);
    const rawReplies = commentIds.length > 0
      ? await db.comment.findMany({
          where: { parentId: { in: commentIds } },
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, photoKey: true } },
            reactions: {
              include: { member: { select: { name: true } } },
            },
          },
        })
      : [];

    const repliesByParent = new Map<string, typeof rawReplies>();
    for (const reply of rawReplies) {
      const pid = reply.parentId!;
      const arr = repliesByParent.get(pid) ?? [];
      arr.push(reply);
      repliesByParent.set(pid, arr);
    }

    function mapReactions(
      reactions: { emoji: string; memberId: string; member: { name: string } }[],
    ) {
      const map = new Map<
        string,
        { count: number; memberNames: string[]; reacted: boolean }
      >();
      for (const r of reactions) {
        const existing = map.get(r.emoji) ?? { count: 0, memberNames: [], reacted: false };
        existing.count++;
        existing.memberNames.push(r.member.name);
        if (r.memberId === member.id) existing.reacted = true;
        map.set(r.emoji, existing);
      }
      return Array.from(map.entries()).map(([emoji, data]) => ({ emoji, ...data }));
    }

    function toCommentData(
      c: (typeof rawComments)[number],
      replies: typeof rawReplies,
    ): CommentData {
      return {
        id: c.id,
        authorId: c.author.id,
        authorName: c.author.name,
        authorPhotoKey: c.author.photoKey,
        bodyMd: c.bodyMd,
        createdAt: c.createdAt.toISOString(),
        editedAt: c.editedAt?.toISOString() ?? null,
        deletedAt: c.deletedAt?.toISOString() ?? null,
        reactions: mapReactions(c.reactions),
        replies: replies.map((r) => toCommentData(r, [])),
      };
    }

    chatComments = rawComments.map((c) =>
      toCommentData(c, repliesByParent.get(c.id) ?? []),
    );
  }

  return (
    <div>
      <TripHeader
        title={trip.title}
        tagline={trip.tagline}
        coverStorageKey={coverStorageKey}
        season={trip.season}
        status={trip.status}
        startDate={trip.startDate}
        endDate={trip.endDate}
        captain={trip.captain}
      />

      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "var(--space-6)",
        }}
      >
        {/* Captain actions */}
        {isCaptain && (
          <TripActions
            tripId={trip.id}
            status={trip.status}
            initialData={{
              title: trip.title,
              tagline: trip.tagline,
              description: trip.descriptionMd,
              startDate: trip.startDate.toISOString().split("T")[0]!,
              endDate: trip.endDate.toISOString().split("T")[0]!,
              season: trip.season,
            }}
          />
        )}

        <TripTabs tripId={trip.id} activeTab={activeTab} />

        {activeTab === "overview" ? (
          <OverviewTab
            description={trip.descriptionMd}
            startDate={trip.startDate}
            endDate={trip.endDate}
            status={trip.status}
            captain={trip.captain}
            activities={activities}
          />
        ) : activeTab === "costs" ? (
          <CostsTab
            tripId={trip.id}
            currentMemberId={member.id}
            costError={costError}
            fxRates={z.record(z.number().finite().positive()).parse(trip.fxRatesJson ?? {})}
            ageWeights={z.object({
              ADULT: z.number(), CHILD_12_17: z.number(), CHILD_5_11: z.number(), CHILD_0_4: z.number(),
            }).parse(trip.ageWeightsJson)}
            rooms={costRooms}
            expenses={costExpenses}
            bankDetails={visibleBankDetails}
            isCaptain={isCaptain}
            tripCurrency={trip.currency}
            tripStatus={trip.status}
            categories={costCategories}
            costOutput={costOutput}
            members={costMembers}
            payments={costPayments}
            adjustments={costAdjustments}
          />
        ) : activeTab === "proposals" ? (
          <ProposalsTab tripId={trip.id} proposals={proposals} />
        ) : activeTab === "chat" ? (
          <ChatTab
            tripId={trip.id}
            currentMemberId={member.id}
            initialComments={chatComments}
            members={chatMembers}
          />
        ) : (
          <PlaceholderTab
            label={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          />
        )}
      </div>
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "var(--space-16) var(--space-6)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-instrument)",
          fontSize: "var(--text-2xl)",
          fontStyle: "italic",
          color: "var(--text-soft)",
          margin: "0 0 var(--space-2) 0",
        }}
      >
        {label}
      </p>
      <p style={{ color: "var(--text-soft)", margin: 0 }}>
        Coming in the next update.
      </p>
    </div>
  );
}
