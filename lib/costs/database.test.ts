import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import { computeCosts } from "./compute";
import { memberCommitment } from "./commitments";

const url = process.env.M6_TEST_DATABASE_URL;

describe.skipIf(!url)("M6 PostgreSQL integration", () => {
  it("persists snapshots, adjustments, payments, exclusions and cascading deletions", async () => {
    if (!url)
      throw new Error(
        "M6_TEST_DATABASE_URL must point to a disposable test database",
      );
    const client = new PrismaClient({ datasourceUrl: url });
    const familyId = createId();
    const captainId = createId();
    const childId = createId();
    const tripId = createId();
    const categoryId = createId();
    const lineId = createId();
    const householdId = createId();
    try {
      await client.family.create({
        data: {
          id: familyId,
          name: "M6 test family",
          inviteTokenHash: createId(),
          homeCurrency: "GBP",
        },
      });
      await client.household.create({
        data: { id: householdId, familyId, name: "Test household" },
      });
      await client.member.create({
        data: {
          id: captainId,
          familyId,
          householdId,
          name: "Test captain",
          calendarToken: createId(),
        },
      });
      await client.member.create({
        data: {
          id: childId,
          familyId,
          householdId,
          guardianId: captainId,
          isDependent: true,
          ageBand: "CHILD_5_11",
          name: "Test dependent",
          calendarToken: createId(),
        },
      });
      await client.trip.create({
        data: {
          id: tripId,
          familyId,
          captainId,
          title: "Test trip",
          descriptionMd: "",
          season: "OTHER",
          status: "PLANNING",
          startDate: new Date("2026-11-01"),
          endDate: new Date("2026-11-03"),
          currency: "GBP",
          fxRatesJson: { EUR: 1.15 },
          ageWeightsJson: {
            ADULT: 1,
            CHILD_12_17: 1,
            CHILD_5_11: 0.5,
            CHILD_0_4: 0,
          },
          bankDetails: "Test-only payment instructions",
        },
      });
      await client.costCategory.create({
        data: {
          id: categoryId,
          tripId,
          name: "Accommodation",
          sort: 0,
          isAccommodation: true,
        },
      });
      await client.costLine.create({
        data: {
          id: lineId,
          tripId,
          categoryId,
          label: "Villa",
          amountMinor: 240000,
          currency: "GBP",
          basis: "SHARED_BY_PERSON_NIGHTS",
          unit: "NIGHT",
          sort: 0,
        },
      });
      await client.attendance.createMany({
        data: [
          {
            tripId,
            memberId: captainId,
            date: new Date("2026-11-01"),
            status: "IN",
          },
          {
            tripId,
            memberId: captainId,
            date: new Date("2026-11-02"),
            status: "IN",
          },
          {
            tripId,
            memberId: childId,
            date: new Date("2026-11-01"),
            status: "MAYBE",
          },
        ],
      });
      const initial = await computeCosts(tripId, client);
      expect(initial.totals).toEqual({
        estimateMinor: 240000,
        allocatedMinor: 240000,
        unallocatedMinor: 0,
      });
      expect(
        initial.perMember.find((m) => m.memberId === childId)?.totalMinor,
      ).toBe(48000);
      await computeCosts(tripId, client);
      expect(await client.costSnapshot.count({ where: { tripId } })).toBe(1);

      await client.costAdjustment.create({
        data: {
          id: createId(),
          tripId,
          memberId: captainId,
          lineId,
          overrideMinor: 190000,
          createdById: captainId,
          reason: "Own meals",
        },
      });
      const adjusted = await computeCosts(tripId, client);
      expect(adjusted.totals.unallocatedMinor).toBe(2000);
      expect(await client.costSnapshot.count({ where: { tripId } })).toBe(2);
      await client.costAdjustment.createMany({
        data: [captainId, childId].map((memberId) => ({
          id: createId(),
          tripId,
          memberId,
          deltaMinor: 1000,
          reason: "Shortfall spread",
          createdById: captainId,
        })),
      });
      expect((await computeCosts(tripId, client)).totals.unallocatedMinor).toBe(
        0,
      );
      await client.payment.createMany({
        data: [
          {
            id: createId(),
            tripId,
            fromMemberId: captainId,
            amountMinor: 115000,
            currency: "EUR",
            method: "BANK",
            paidOn: new Date("2026-11-01"),
            confirmedAt: new Date(),
            confirmedById: captainId,
          },
          {
            id: createId(),
            tripId,
            fromMemberId: captainId,
            amountMinor: 10000,
            currency: "GBP",
            method: "CASH",
            paidOn: new Date("2026-11-01"),
          },
        ],
      });
      const payments = await client.payment.findMany({ where: { tripId } });
      const commitment = memberCommitment(
        await computeCosts(tripId, client),
        [captainId, childId],
        payments,
        "GBP",
        { EUR: 1.15 },
      );
      expect(commitment).toEqual(
        expect.objectContaining({
          shareMinor: 240000,
          paidMinor: 100000,
          outstandingMinor: 140000,
        }),
      );
      await client.trip.update({
        where: { id: tripId },
        data: { status: "CONFIRMED" },
      });
      expect(
        (await computeCosts(tripId, client)).perMember.find(
          (m) => m.memberId === childId,
        )?.nights,
      ).toBe(0);
      await client.householdOwnStay.create({ data: { tripId, householdId } });
      expect((await computeCosts(tripId, client)).warnings).toContainEqual(
        expect.stringContaining("no eligible attendees"),
      );
      await client.costLine.delete({ where: { id: lineId } });
      expect(await client.costAdjustment.count({ where: { lineId } })).toBe(0);
      expect(await client.costAdjustment.count({ where: { tripId } })).toBe(2);
    } finally {
      try {
        await client.trip.deleteMany({ where: { id: tripId } });
        await client.family.deleteMany({ where: { id: familyId } });
      } finally {
        await client.$disconnect();
      }
    }
  }, 30000);
});
