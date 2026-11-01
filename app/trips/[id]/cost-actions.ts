"use server";

import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { computeCosts } from "@/lib/costs/compute";
import { z } from "zod";
import type { Prisma, Trip } from "@prisma/client";

const idSchema = z.string().min(1).max(100);
const nameSchema = z.string().trim().min(1).max(200);
const moneySchema = z.number().int().min(-2147483648).max(2147483647);
const currencySchema = z.enum(["GBP", "EUR"]);
const ratesSchema = z.record(currencySchema, z.number().finite().positive());
const costLineSchema = z.object({
  label: nameSchema,
  amountMinor: moneySchema.nonnegative(),
  currency: currencySchema,
  basis: z.enum([
    "PER_PERSON_PER_NIGHT",
    "PER_PERSON_FLAT",
    "PER_ROOM_PER_NIGHT",
    "SHARED_BY_PERSON_NIGHTS",
    "SHARED_EQUAL",
    "PER_HOUSEHOLD_FLAT",
    "PER_PERSON_PER_DAY_FOOD",
  ]),
  unit: z.enum(["NIGHT", "DAY", "FLAT"]),
  applyAgeWeights: z.boolean(),
  mealsPerDay: z.number().int().min(1).max(10).optional(),
  note: z.string().max(500).optional(),
  url: z
    .string()
    .url()
    .refine((url) => /^https?:\/\//.test(url), "Use an HTTP or HTTPS link")
    .optional(),
});
const adjustSchema = z
  .object({
    lineId: idSchema.optional(),
    categoryId: idSchema.optional(),
    deltaMinor: moneySchema.optional(),
    overrideMinor: moneySchema.nonnegative().optional(),
    reason: z.string().max(500).optional(),
  })
  .refine(
    (data) =>
      (data.deltaMinor !== undefined) !== (data.overrideMinor !== undefined),
    "Choose a delta or an override",
  )
  .refine(
    (data) => !(data.lineId && data.categoryId),
    "Choose one adjustment scope",
  );

async function mutateCosts(
  tripId: string,
  type: string,
  captainOnly: boolean,
  mutate: (
    tx: Prisma.TransactionClient,
    trip: Trip,
    actorId: string,
  ) => Promise<Prisma.InputJsonObject>,
) {
  idSchema.parse(tripId);
  const { member, family } = await requireMember();
  await db.$transaction(
    async (tx) => {
      const trip = await tx.trip.findFirstOrThrow({
        where: { id: tripId, familyId: family.id },
      });
      if (captainOnly && trip.captainId !== member.id)
        throw new Error("Only the captain can change the estimate");
      const payload = await mutate(tx, trip, member.id);
      await tx.activityLog.create({
        data: {
          id: createId(),
          actorId: member.id,
          tripId,
          type,
          payloadJson: payload,
        },
      });
      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: { revision: { increment: 1 } },
      });
      const output = await computeCosts(tripId, tx);
      await tx.tripRevision.create({
        data: {
          id: createId(),
          tripId,
          revision: updatedTrip.revision,
          actorId: member.id,
          summary: type.replaceAll("_", " "),
          snapshotJson: {
            title: updatedTrip.title,
            tagline: updatedTrip.tagline,
            descriptionMd: updatedTrip.descriptionMd,
            season: updatedTrip.season,
            status: updatedTrip.status,
            currency: updatedTrip.currency,
            startDate: updatedTrip.startDate.toISOString(),
            endDate: updatedTrip.endDate.toISOString(),
            fxRatesJson: updatedTrip.fxRatesJson,
            ageWeightsJson: updatedTrip.ageWeightsJson,
            costs: {
              ...output,
              perMember: output.perMember.map((m) => ({
                ...m,
                explain: m.explain.map((s) => ({ ...s })),
              })),
            },
          },
        },
      });
      const attendees = await tx.member.findMany({
        where: {
          familyId: family.id,
          attendance: { some: { tripId, status: { in: ["IN", "MAYBE"] } } },
        },
        select: { id: true, guardianId: true },
      });
      const recipients = new Set([
        trip.captainId,
        ...attendees.map((m) => m.guardianId ?? m.id),
      ]);
      recipients.delete(member.id);
      await tx.notification.createMany({
        data: [...recipients].map((memberId) => ({
          id: createId(),
          memberId,
          type: "COST_CHANGED",
          payloadJson: { tripId, tripTitle: trip.title },
        })),
      });
    },
    { isolationLevel: "Serializable" },
  );
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/me");
  revalidatePath("/inbox");
}

export async function addCostCategory(
  tripId: string,
  name: string,
  isAccommodation = false,
) {
  const parsedName = nameSchema.parse(name);
  z.boolean().parse(isAccommodation);
  await mutateCosts(tripId, "cost_category_add", true, async (tx) => {
    const max = await tx.costCategory.aggregate({
      where: { tripId },
      _max: { sort: true },
    });
    await tx.costCategory.create({
      data: {
        id: createId(),
        tripId,
        name: parsedName,
        isAccommodation,
        sort: (max._max.sort ?? -1) + 1,
      },
    });
    return { name: parsedName, isAccommodation };
  });
}

export async function updateCostCategory(
  categoryId: string,
  name: string,
  isAccommodation?: boolean,
) {
  idSchema.parse(categoryId);
  const parsedName = nameSchema.parse(name);
  z.boolean().optional().parse(isAccommodation);
  const { family } = await requireMember();
  const category = await db.costCategory.findFirstOrThrow({
    where: { id: categoryId, trip: { familyId: family.id } },
  });
  await mutateCosts(
    category.tripId,
    "cost_category_update",
    true,
    async (tx) => {
      await tx.costCategory.update({
        where: { id: categoryId },
        data: { name: parsedName, isAccommodation },
      });
      return { categoryId, name: parsedName };
    },
  );
}

export async function removeCostCategory(categoryId: string) {
  idSchema.parse(categoryId);
  const { family } = await requireMember();
  const category = await db.costCategory.findFirstOrThrow({
    where: { id: categoryId, trip: { familyId: family.id } },
  });
  await mutateCosts(
    category.tripId,
    "cost_category_remove",
    true,
    async (tx) => {
      await tx.costCategory.delete({ where: { id: categoryId } });
      return { categoryId };
    },
  );
}

export async function addCostLine(
  tripId: string,
  categoryId: string,
  data: z.infer<typeof costLineSchema>,
) {
  idSchema.parse(categoryId);
  const parsed = costLineSchema.parse(data);
  await mutateCosts(tripId, "cost_line_add", true, async (tx) => {
    await tx.costCategory.findFirstOrThrow({
      where: { id: categoryId, tripId },
    });
    const max = await tx.costLine.aggregate({
      where: { categoryId },
      _max: { sort: true },
    });
    await tx.costLine.create({
      data: {
        ...parsed,
        id: createId(),
        tripId,
        categoryId,
        sort: (max._max.sort ?? -1) + 1,
      },
    });
    return { categoryId, label: parsed.label };
  });
}

export async function updateCostLine(
  lineId: string,
  data: z.infer<typeof costLineSchema>,
) {
  idSchema.parse(lineId);
  const parsed = costLineSchema.parse(data);
  const { family } = await requireMember();
  const line = await db.costLine.findFirstOrThrow({
    where: { id: lineId, trip: { familyId: family.id } },
  });
  await mutateCosts(line.tripId, "cost_line_update", true, async (tx) => {
    await tx.costLine.update({
      where: { id: lineId },
      data: { ...parsed, note: parsed.note ?? null, url: parsed.url ?? null },
    });
    return { lineId, label: parsed.label };
  });
}

export async function removeCostLine(lineId: string) {
  idSchema.parse(lineId);
  const { family } = await requireMember();
  const line = await db.costLine.findFirstOrThrow({
    where: { id: lineId, trip: { familyId: family.id } },
  });
  await mutateCosts(line.tripId, "cost_line_remove", true, async (tx) => {
    await tx.costLine.delete({ where: { id: lineId } });
    return { lineId };
  });
}

export async function adjustCost(
  tripId: string,
  memberId: string,
  data: z.infer<typeof adjustSchema>,
) {
  idSchema.parse(memberId);
  const parsed = adjustSchema.parse(data);
  await mutateCosts(tripId, "cost_adjust", false, async (tx, trip, actorId) => {
    const target = await tx.member.findFirstOrThrow({
      where: { id: memberId, familyId: trip.familyId },
    });
    if (
      actorId !== memberId &&
      trip.captainId !== actorId &&
      !(target.isDependent && target.guardianId === actorId)
    ) {
      throw new Error(
        "You can only adjust your own or your dependents' shares",
      );
    }
    if (parsed.lineId)
      await tx.costLine.findFirstOrThrow({
        where: { id: parsed.lineId, tripId },
      });
    if (parsed.categoryId)
      await tx.costCategory.findFirstOrThrow({
        where: { id: parsed.categoryId, tripId },
      });
    await tx.costAdjustment.create({
      data: {
        ...parsed,
        id: createId(),
        tripId,
        memberId,
        createdById: actorId,
      },
    });
    return { memberId, ...parsed };
  });
}

export async function spreadShortfall(tripId: string) {
  await mutateCosts(
    tripId,
    "cost_spread_shortfall",
    true,
    async (tx, _trip, actorId) => {
      const output = await computeCosts(tripId, tx);
      const shortfall = output.totals.unallocatedMinor;
      if (shortfall <= 0) throw new Error("There is no shortfall to spread");
      const eligible = output.perMember.filter((m) => m.nights > 0);
      if (eligible.length === 0)
        throw new Error("No attendees to spread the shortfall across");
      const share = Math.floor(shortfall / eligible.length);
      const remainder = shortfall % eligible.length;
      await tx.costAdjustment.createMany({
        data: eligible.map((m, index) => ({
          id: createId(),
          tripId,
          memberId: m.memberId,
          deltaMinor: share + (index < remainder ? 1 : 0),
          reason: "Shortfall spread",
          createdById: actorId,
        })),
      });
      return { shortfall, memberCount: eligible.length };
    },
  );
}

export async function setFxRate(
  tripId: string,
  rates: Record<string, number>,
  asOf: string,
) {
  const parsed = ratesSchema.parse(rates);
  const date = z.string().datetime().parse(asOf);
  await mutateCosts(tripId, "cost_fx_rate_set", true, async (tx, trip) => {
    const existing = ratesSchema.parse(trip.fxRatesJson ?? {});
    await tx.trip.update({
      where: { id: tripId },
      data: { fxRatesJson: { ...existing, ...parsed }, fxAsOf: new Date(date) },
    });
    return { rates: parsed, asOf: date };
  });
}

export async function setAgeWeights(
  tripId: string,
  weights: Record<string, number>,
) {
  const value = z
    .object({
      ADULT: z.number().finite().min(0).max(10),
      CHILD_12_17: z.number().finite().min(0).max(10),
      CHILD_5_11: z.number().finite().min(0).max(10),
      CHILD_0_4: z.number().finite().min(0).max(10),
    })
    .parse(weights);
  await mutateCosts(tripId, "cost_age_weights_set", true, async (tx) => {
    await tx.trip.update({
      where: { id: tripId },
      data: { ageWeightsJson: value },
    });
    return { weights: value };
  });
}

export async function addRoom(
  tripId: string,
  label: string,
  memberIds: string[],
) {
  const name = nameSchema.parse(label);
  const ids = z.array(idSchema).min(1).max(100).parse(memberIds);
  if (new Set(ids).size !== ids.length)
    throw new Error("Each room member must be unique");
  await mutateCosts(tripId, "cost_room_add", true, async (tx, trip) => {
    const members = await tx.member.count({
      where: { id: { in: ids }, familyId: trip.familyId },
    });
    if (members !== ids.length)
      throw new Error("Room members must belong to this family");
    const assigned = await tx.roomMember.count({
      where: { memberId: { in: ids }, room: { tripId } },
    });
    if (assigned > 0)
      throw new Error("A member can only be assigned to one room per trip");
    await tx.room.create({
      data: {
        id: createId(),
        tripId,
        label: name,
        members: { create: ids.map((memberId) => ({ memberId })) },
      },
    });
    return { label: name, memberIds: ids };
  });
}

export async function removeRoom(roomId: string) {
  idSchema.parse(roomId);
  const { family } = await requireMember();
  const room = await db.room.findFirstOrThrow({
    where: { id: roomId, trip: { familyId: family.id } },
  });
  await mutateCosts(room.tripId, "cost_room_remove", true, async (tx) => {
    await tx.room.delete({ where: { id: roomId } });
    return { roomId };
  });
}

export async function setBankDetails(tripId: string, details: string) {
  const value = z.string().trim().max(2000).parse(details);
  await mutateCosts(tripId, "cost_bank_details_set", true, async (tx) => {
    await tx.trip.update({
      where: { id: tripId },
      data: { bankDetails: value || null },
    });
    return { updated: true };
  });
}
