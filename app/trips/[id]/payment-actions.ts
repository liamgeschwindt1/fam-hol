"use server";

import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { computeCosts } from "@/lib/costs/compute";
import { convertMinor, formatMoney } from "@/lib/costs/money";
import { z } from "zod";
import sharp from "sharp";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorage } from "@/lib/storage";

const idSchema = z.string().min(1).max(100);
const paymentSchema = z.object({
  amountMinor: z.number().int().positive().max(2147483647),
  currency: z.enum(["GBP", "EUR"]),
  method: z.enum(["BANK", "CASH", "OTHER"]),
  note: z.string().trim().max(1000),
  paidOn: z.string().date(),
});
const ratesSchema = z.record(z.number().finite().positive());

function refreshPayments(tripId: string) {
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/me");
  revalidatePath("/inbox");
}

export async function logPayment(
  tripId: string,
  amountMinor: number,
  currency: string,
  method: string,
  note: string,
  paidOn = new Date().toISOString().slice(0, 10),
  proofData?: FormData,
) {
  idSchema.parse(tripId);
  const parsed = paymentSchema.parse({
    amountMinor,
    currency,
    method,
    note,
    paidOn,
  });
  z.instanceof(FormData).optional().parse(proofData);
  const { member, family } = await requireMember();
  const trip = await db.trip.findFirstOrThrow({
    where: { id: tripId, familyId: family.id },
  });
  convertMinor(
    parsed.amountMinor,
    parsed.currency,
    trip.currency,
    ratesSchema.parse(trip.fxRatesJson ?? {}),
  );
  const proof = proofData?.get("proof");
  let proofKey: string | null = null;
  if (proof && (!(proof instanceof File) || proof.size > 0)) {
    const file = z
      .instanceof(File)
      .refine(
        (value) => value.size <= 12 * 1024 * 1024,
        "Screenshot must be under 12 MB",
      )
      .refine(
        (value) =>
          ["image/jpeg", "image/png", "image/webp"].includes(value.type),
        "Choose a JPEG, PNG or WebP screenshot",
      )
      .parse(proof);
    const image = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40000000,
    })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp()
      .toBuffer();
    proofKey = `payment-proofs/${family.id}/${member.id}/${createId()}.webp`;
    const { client, bucket } = getStorage();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: proofKey,
        Body: image,
        ContentType: "image/webp",
      }),
      { abortSignal: AbortSignal.timeout(10000) },
    );
  }
  try {
    await db.$transaction(async (tx) => {
      const currentTrip = await tx.trip.findFirstOrThrow({
        where: { id: tripId, familyId: family.id },
      });
      await tx.payment.create({
        data: {
          ...parsed,
          id: createId(),
          tripId,
          fromMemberId: member.id,
          proofKey,
          paidOn: new Date(`${parsed.paidOn}T00:00:00Z`),
        },
      });
      await tx.activityLog.create({
        data: {
          id: createId(),
          actorId: member.id,
          tripId,
          type: "payment_logged",
          payloadJson: parsed,
        },
      });
      await tx.notification.create({
        data: {
          id: createId(),
          memberId: currentTrip.captainId,
          type: "PAYMENT_LOGGED",
          payloadJson: { tripId, authorName: member.name },
        },
      });
    });
  } catch (error) {
    if (proofKey) {
      const { client, bucket } = getStorage();
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: proofKey }),
          { abortSignal: AbortSignal.timeout(10000) },
        );
      } catch (cleanupError) {
        console.error("Payment screenshot cleanup failed", {
          proofKey,
          cleanupError,
        });
      }
    }
    throw error;
  }
  refreshPayments(tripId);
}

export async function getPaymentProof(paymentId: string): Promise<string> {
  idSchema.parse(paymentId);
  const { member, family } = await requireMember();
  const payment = await db.payment.findFirstOrThrow({
    where: { id: paymentId, trip: { familyId: family.id } },
    include: { trip: true },
  });
  if (
    payment.fromMemberId !== member.id &&
    payment.trip.captainId !== member.id
  ) {
    throw new Error("Only the payer and captain can view this screenshot");
  }
  if (!payment.proofKey) throw new Error("This payment has no screenshot");
  const { client, bucket } = getStorage();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: payment.proofKey }),
    { expiresIn: 300 },
  );
}

export async function confirmPayment(paymentId: string) {
  idSchema.parse(paymentId);
  const { member, family } = await requireMember();
  const tripId = await db.$transaction(
    async (tx) => {
      const payment = await tx.payment.findFirstOrThrow({
        where: { id: paymentId, trip: { familyId: family.id } },
        include: { trip: true },
      });
      if (payment.trip.captainId !== member.id)
        throw new Error("Only the captain can confirm payments");
      if (payment.confirmedAt)
        throw new Error("This payment is already confirmed");
      await tx.payment.update({
        where: { id: paymentId },
        data: { confirmedAt: new Date(), confirmedById: member.id },
      });
      await tx.activityLog.create({
        data: {
          id: createId(),
          actorId: member.id,
          tripId: payment.tripId,
          type: "payment_confirmed",
          payloadJson: { paymentId },
        },
      });
      await tx.notification.create({
        data: {
          id: createId(),
          memberId: payment.fromMemberId,
          type: "PAYMENT_CONFIRMED",
          payloadJson: { tripId: payment.tripId },
        },
      });
      return payment.tripId;
    },
    { isolationLevel: "Serializable" },
  );
  refreshPayments(tripId);
}

export async function sendPaymentReminder(tripId: string, memberId: string) {
  idSchema.parse(tripId);
  idSchema.parse(memberId);
  const { member, family } = await requireMember();
  await db.$transaction(async (tx) => {
    const trip = await tx.trip.findFirstOrThrow({
      where: { id: tripId, familyId: family.id },
    });
    if (trip.captainId !== member.id)
      throw new Error("Only the captain can send reminders");
    const target = await tx.member.findFirstOrThrow({
      where: { id: memberId, familyId: family.id },
    });
    const output = await computeCosts(tripId, tx);
    if (target.isDependent && !target.guardianId) {
      throw new Error(
        "This dependent needs a guardian to receive a payment reminder",
      );
    }
    const recipientId = target.guardianId ?? target.id;
    const relevantIds = [
      recipientId,
      ...(
        await tx.member.findMany({
          where: { guardianId: recipientId, familyId: family.id },
          select: { id: true },
        })
      ).map((m) => m.id),
    ];
    const share = output.perMember
      .filter((m) => relevantIds.includes(m.memberId))
      .reduce((sum, m) => sum + m.totalMinor, 0);
    const payments = await tx.payment.findMany({
      where: {
        tripId,
        fromMemberId: { in: relevantIds },
        confirmedAt: { not: null },
      },
    });
    const rates = ratesSchema.parse(trip.fxRatesJson ?? {});
    const paid = payments.reduce(
      (sum, p) =>
        sum + convertMinor(p.amountMinor, p.currency, trip.currency, rates),
      0,
    );
    const outstanding = share - paid;
    if (outstanding <= 0) throw new Error("This share is already covered");
    await tx.notification.create({
      data: {
        id: createId(),
        memberId: recipientId,
        type: "PAYMENT_REMINDER",
        payloadJson: {
          tripId,
          tripTitle: trip.title,
          amount: formatMoney(outstanding, trip.currency),
        },
      },
    });
    await tx.activityLog.create({
      data: {
        id: createId(),
        actorId: member.id,
        tripId,
        type: "payment_reminder",
        payloadJson: { memberId, outstanding },
      },
    });
  });
  refreshPayments(tripId);
}

export async function logExpense(
  tripId: string,
  amountMinor: number,
  currency: string,
  description: string,
) {
  idSchema.parse(tripId);
  const parsed = z
    .object({
      amountMinor: paymentSchema.shape.amountMinor,
      currency: paymentSchema.shape.currency,
      description: z.string().trim().min(1).max(1000),
    })
    .parse({ amountMinor, currency, description });
  const { member, family } = await requireMember();
  await db.$transaction(async (tx) => {
    const trip = await tx.trip.findFirstOrThrow({
      where: { id: tripId, familyId: family.id },
    });
    convertMinor(
      parsed.amountMinor,
      parsed.currency,
      trip.currency,
      ratesSchema.parse(trip.fxRatesJson ?? {}),
    );
    await tx.expense.create({
      data: { ...parsed, id: createId(), tripId, paidByMemberId: member.id },
    });
    await tx.activityLog.create({
      data: {
        id: createId(),
        actorId: member.id,
        tripId,
        type: "expense_logged",
        payloadJson: parsed,
      },
    });
  });
  refreshPayments(tripId);
}
