import crypto from "crypto";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import {
  calculateCosts,
  type EngineInput,
  type EngineOutput,
} from "@/lib/costs/engine";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const ratesSchema = z.record(z.number().finite().positive());
const weightsSchema = z.object({
  ADULT: z.number().finite().nonnegative(),
  CHILD_12_17: z.number().finite().nonnegative(),
  CHILD_5_11: z.number().finite().nonnegative(),
  CHILD_0_4: z.number().finite().nonnegative(),
});
const outputSchema = z.object({
  perMember: z.array(
    z.object({
      memberId: z.string(),
      totalMinor: z.number().int(),
      byCategory: z.record(z.number().int()),
      byLine: z.record(z.number().int()),
      nights: z.number().int(),
      explain: z.array(
        z.object({
          lineId: z.string(),
          lineLabel: z.string(),
          categoryId: z.string(),
          description: z.string(),
          amountMinor: z.number().int(),
        }),
      ),
    }),
  ),
  totals: z.object({
    estimateMinor: z.number().int(),
    allocatedMinor: z.number().int(),
    unallocatedMinor: z.number().int(),
  }),
  warnings: z.array(z.string()),
});

/**
 * Load trip data, build EngineInput, call calculateCosts, cache in CostSnapshot.
 */
export async function computeCosts(
  tripId: string,
  client: Prisma.TransactionClient = db,
): Promise<EngineOutput> {
  const trip = await client.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      id: true,
      familyId: true,
      status: true,
      startDate: true,
      endDate: true,
      currency: true,
      fxRatesJson: true,
      ageWeightsJson: true,
    },
  });

  const [members, attendance, categories, rooms, adjustments, ownStays] =
    await Promise.all([
      client.member.findMany({
        where: { familyId: trip.familyId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          householdId: true,
          ageBand: true,
          guardianId: true,
        },
      }),

      client.attendance.findMany({
        where: { tripId },
        orderBy: [{ memberId: "asc" }, { date: "asc" }],
        select: { memberId: true, date: true, status: true },
      }),

      client.costCategory.findMany({
        where: { tripId },
        include: {
          lines: {
            orderBy: [{ sort: "asc" }, { id: "asc" }],
          },
        },
        orderBy: [{ sort: "asc" }, { id: "asc" }],
      }),

      client.room.findMany({
        where: { tripId },
        orderBy: { id: "asc" },
        include: {
          members: { select: { memberId: true }, orderBy: { memberId: "asc" } },
        },
      }),

      client.costAdjustment.findMany({
        where: { tripId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          memberId: true,
          lineId: true,
          categoryId: true,
          deltaMinor: true,
          overrideMinor: true,
          reason: true,
        },
      }),

      client.householdOwnStay.findMany({
        where: { tripId },
        orderBy: { householdId: "asc" },
        select: { householdId: true },
      }),
    ]);

  const lines = categories.flatMap((cat) =>
    cat.lines.map((line) => ({
      id: line.id,
      categoryId: line.categoryId,
      label: line.label,
      amountMinor: line.amountMinor,
      currency: line.currency,
      basis: line.basis,
      unit: line.unit,
      applyAgeWeights: line.applyAgeWeights,
      mealsPerDay: line.mealsPerDay ?? undefined,
    })),
  );

  const fxRates = ratesSchema.parse(trip.fxRatesJson ?? {});
  const ageWeights = weightsSchema.parse(trip.ageWeightsJson);

  const engineInput: EngineInput = {
    trip: {
      id: trip.id,
      startDate: trip.startDate.toISOString().split("T")[0]!,
      endDate: trip.endDate.toISOString().split("T")[0]!,
      currency: trip.currency,
      fxRates,
    },
    members: members.map((m) => ({
      id: m.id,
      householdId: m.householdId,
      ageBand: m.ageBand,
      guardianId: m.guardianId ?? undefined,
    })),
    attendance: attendance.map((a) => ({
      memberId: a.memberId,
      date: a.date.toISOString().split("T")[0]!,
      status: a.status,
    })),
    lines,
    rooms: rooms.map((r) => ({
      id: r.id,
      label: r.label,
      memberIds: r.members.map((rm) => rm.memberId),
    })),
    ageWeights,
    includeMaybe: trip.status === "IDEA" || trip.status === "PLANNING",
    adjustments: adjustments.map((a) => ({
      memberId: a.memberId,
      lineId: a.lineId ?? undefined,
      categoryId: a.categoryId ?? undefined,
      deltaMinor: a.deltaMinor ?? undefined,
      overrideMinor: a.overrideMinor ?? undefined,
      reason: a.reason ?? undefined,
    })),
    excludedHouseholdIds: ownStays.map((s) => s.householdId),
    accommodationCategoryIds: categories
      .filter((c) => c.isAccommodation)
      .map((c) => c.id),
  };

  // Hash the input for caching
  const inputJson = JSON.stringify({ engineVersion: 2, input: engineInput });
  const inputHash = crypto.createHash("sha256").update(inputJson).digest("hex");

  // Check cache
  const cached = await client.costSnapshot.findFirst({
    where: { tripId, inputHash },
    orderBy: { computedAt: "desc" },
  });

  if (cached) {
    return outputSchema.parse(cached.outputJson);
  }

  // Compute
  const output = calculateCosts(engineInput);

  // Store snapshot
  await client.costSnapshot.create({
    data: {
      id: createId(),
      tripId,
      inputHash,
      outputJson: {
        ...output,
        perMember: output.perMember.map((m) => ({
          ...m,
          explain: m.explain.map((s) => ({ ...s })),
        })),
      },
      computedAt: new Date(),
    },
  });

  return output;
}
