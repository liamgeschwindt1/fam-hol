import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeCosts } from "@/lib/costs/compute";
import {
  commitmentTotals,
  memberCommitment,
  type Commitment,
} from "@/lib/costs/commitments";
import { formatMoney } from "@/lib/costs/money";
import Link from "next/link";
import type { Metadata } from "next";
import { ProfileActions } from "./ProfileActions";
import { z } from "zod";
import { MemberAvatar } from "@/components/MemberAvatar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Profile" };

type TripCommitment = {
  tripId: string;
  title: string;
  currency: string;
  status: string;
  rates: Record<string, number>;
  categories: { id: string; name: string }[];
} & ({ result: Commitment; error: null } | { result: null; error: string });

function Summary({
  commitments,
  currency,
}: {
  commitments: TripCommitment[];
  currency: string;
}) {
  if (commitments.some((c) => c.error)) {
    return (
      <p role="alert">
        The {currency} summary is unavailable until the trip calculation errors
        are resolved.
      </p>
    );
  }
  let totals;
  try {
    totals = commitmentTotals(
      commitments.flatMap((c) =>
        c.result
          ? [
              {
                ...c.result,
                currency: c.currency,
                rates: c.rates,
              },
            ]
          : [],
      ),
      currency,
    );
  } catch (error) {
    console.error("Commitment currency conversion failed", { currency, error });
    return (
      <p role="alert">
        Set the trips’ fixed exchange rates to see a summary in {currency}.
        Individual shares are shown below.
      </p>
    );
  }
  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <p className="label-caps">{currency} commitments</p>
      <p
        style={{
          fontFamily: "var(--font-instrument)",
          fontSize: "var(--text-3xl)",
          margin: "var(--space-2) 0",
        }}
      >
        {formatMoney(totals.outstandingMinor, currency)} outstanding
      </p>
      <p className="money">
        {formatMoney(totals.shareMinor, currency)} committed ·{" "}
        {formatMoney(totals.paidMinor, currency)} paid
      </p>
      <details>
        <summary>How is the summary worked out?</summary>
        <p>
          Trip shares and confirmed payments are converted using each trip’s
          fixed rate, rounded to minor units, then added. Outstanding is
          committed minus paid. Pending payments are not included.
        </p>
        {commitments.map((c) => (
          <p key={c.tripId}>
            {c.title}:{" "}
            {c.currency === currency
              ? "no conversion"
              : `1 ${c.currency} = ${c.rates[currency]} ${currency}`}
          </p>
        ))}
      </details>
    </div>
  );
}

export default async function MePage() {
  const { member, family } = await requireMember();
  const fullMember = await db.member.findFirstOrThrow({
    where: { id: member.id, familyId: family.id },
    include: {
      userAccount: true,
      household: true,
      dependents: { select: { id: true, name: true } },
    },
  });
  const ids = [member.id, ...fullMember.dependents.map((m) => m.id)];
  const names = new Map([
    [member.id, member.name],
    ...fullMember.dependents.map((m): [string, string] => [m.id, m.name]),
  ]);
  const trips = await db.trip.findMany({
    where: {
      familyId: family.id,
      OR: [
        {
          attendance: {
            some: { memberId: { in: ids }, status: { in: ["IN", "MAYBE"] } },
          },
        },
        { costAdjustments: { some: { memberId: { in: ids } } } },
        { payments: { some: { fromMemberId: { in: ids } } } },
        { captainId: member.id },
      ],
    },
    orderBy: { startDate: "asc" },
    include: {
      payments: { where: { fromMemberId: { in: ids } } },
      costCategories: {
        select: { id: true, name: true },
        orderBy: { sort: "asc" },
      },
    },
  });
  const commitments: TripCommitment[] = await Promise.all(
    trips.map(async (trip): Promise<TripCommitment> => {
      const base = {
        tripId: trip.id,
        title: trip.title,
        currency: trip.currency,
        status: trip.status,
        categories: trip.costCategories,
        rates: {},
      };
      try {
        const rates = z
          .record(z.number().finite().positive())
          .parse(trip.fxRatesJson ?? {});
        const output = await computeCosts(trip.id);
        const result = memberCommitment(
          output,
          ids,
          trip.payments,
          trip.currency,
          rates,
        );
        return { ...base, rates, result, error: null };
      } catch (error) {
        console.error("Profile cost calculation failed", {
          tripId: trip.id,
          error,
        });
        return {
          ...base,
          result: null,
          error:
            "This trip’s costs are unavailable. The captain needs to check the estimate and exchange rates.",
        };
      }
    }),
  );

  return (
    <div
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-6)",
      }}
    >
      <section style={{ marginBottom: "var(--space-8)" }}>
        <MemberAvatar name={fullMember.name} photoKey={fullMember.photoKey} size={72} />
        <h1
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-3xl)",
            fontWeight: 400,
          }}
        >
          {fullMember.name}
        </h1>
        <p>
          {fullMember.household?.name}
          {fullMember.isAdmin ? " · Admin" : ""}
        </p>
        {fullMember.dependents.length > 0 && (
          <p>
            Including dependents:{" "}
            {fullMember.dependents.map((m) => m.name).join(", ")}
          </p>
        )}
      </section>
      <section style={{ marginBottom: "var(--space-8)" }}>
        <h2 className="label-caps">My commitments</h2>
        <Summary commitments={commitments} currency={family.homeCurrency} />
        {family.secondCurrency &&
          family.secondCurrency !== family.homeCurrency && (
            <Summary
              commitments={commitments}
              currency={family.secondCurrency}
            />
          )}
        {commitments.length === 0 && <p>No trip commitments yet.</p>}
        {commitments.map((c) => {
          const confirmed = !["IDEA", "PLANNING"].includes(c.status);
          const status =
            c.result && confirmed && c.result.outstandingMinor <= 0
              ? "Settled"
              : confirmed
                ? "Confirmed"
                : "Estimate";
          return (
            <article
              key={c.tripId}
              style={{
                borderTop: "1px solid var(--rule)",
                padding: "var(--space-4) 0",
              }}
            >
              <Link
                href={`/trips/${c.tripId}?tab=costs`}
                style={{
                  fontFamily: "var(--font-instrument)",
                  fontSize: "var(--text-xl)",
                }}
              >
                {c.title}
              </Link>
              {c.result ? (
                <>
                  <p className="label-caps">
                    {status} · {c.currency}
                  </p>
                  <p className="money">
                    {formatMoney(c.result.shareMinor, c.currency)} share ·{" "}
                    {formatMoney(c.result.paidMinor, c.currency)} paid ·{" "}
                    {formatMoney(c.result.outstandingMinor, c.currency)} due
                  </p>
                  <details>
                    <summary>Show how this is worked out</summary>
                    <p>
                      Shares include your dependents. Only confirmed payments
                      count as paid.
                    </p>
                    {c.result.members.map((person) => (
                      <details
                        key={person.memberId}
                        open={person.memberId === member.id}
                        style={{ padding: "var(--space-3) 0" }}
                      >
                        <summary>
                          {names.get(person.memberId)} —{" "}
                          {formatMoney(person.totalMinor, c.currency)} ·{" "}
                          {person.nights} attending dates
                        </summary>
                        {c.categories.map((category) => (
                          <p key={category.id} className="money">
                            {category.name}:{" "}
                            {formatMoney(
                              person.byCategory[category.id] ?? 0,
                              c.currency,
                            )}
                          </p>
                        ))}
                        {person.explain.map((step, index) => (
                          <p key={index}>{step.description}</p>
                        ))}
                      </details>
                    ))}
                  </details>
                </>
              ) : (
                <p role="alert">{c.error}</p>
              )}
            </article>
          );
        })}
      </section>
      <section
        style={{
          borderTop: "1px solid var(--rule)",
          paddingTop: "var(--space-6)",
        }}
      >
        <h2 className="label-caps">Settings</h2>
        <ProfileActions
          calendarToken={fullMember.calendarToken}
          calendarShowCosts={fullMember.calendarShowCosts}
          accountEmail={fullMember.userAccount?.email ?? null}
        />
      </section>
    </div>
  );
}
