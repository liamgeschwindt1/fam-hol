import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmPayment,
  getPaymentProof,
  logExpense,
  logPayment,
  sendPaymentReminder,
} from "./payment-actions";
import sharp from "sharp";

const mocks = vi.hoisted(() => {
  const tx = {
    trip: { findFirstOrThrow: vi.fn() },
    member: { findFirstOrThrow: vi.fn(), findMany: vi.fn() },
    payment: {
      create: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    expense: { create: vi.fn() },
    notification: { create: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    requireMember: vi.fn(),
    computeCosts: vi.fn(),
    revalidatePath: vi.fn(),
    storageSend: vi.fn(),
    signedUrl: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({
  db: { ...mocks.tx, $transaction: mocks.transaction },
}));
vi.mock("@/lib/auth", () => ({ requireMember: mocks.requireMember }));
vi.mock("@/lib/costs/compute", () => ({ computeCosts: mocks.computeCosts }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@paralleldrive/cuid2", () => ({ createId: () => "generated-id" }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    client: { send: mocks.storageSend },
    bucket: "test-bucket",
  }),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.signedUrl,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (action) => action(mocks.tx));
  mocks.requireMember.mockResolvedValue({
    member: { id: "captain", name: "Captain" },
    family: { id: "family" },
  });
  mocks.tx.trip.findFirstOrThrow.mockResolvedValue({
    captainId: "captain",
    title: "Trip",
    currency: "GBP",
    fxRatesJson: { EUR: 1.15 },
  });
  mocks.tx.payment.findFirstOrThrow.mockResolvedValue({
    id: "payment",
    tripId: "trip",
    fromMemberId: "guardian",
    confirmedAt: null,
    trip: { captainId: "captain" },
  });
  mocks.tx.member.findFirstOrThrow.mockResolvedValue({
    id: "guardian",
    guardianId: null,
    isDependent: false,
  });
  mocks.tx.member.findMany.mockResolvedValue([{ id: "child" }]);
  mocks.tx.payment.findMany.mockResolvedValue([
    { amountMinor: 11500, currency: "EUR" },
  ]);
  mocks.computeCosts.mockResolvedValue({
    perMember: [
      { memberId: "guardian", totalMinor: 10000 },
      { memberId: "child", totalMinor: 5000 },
    ],
  });
  mocks.storageSend.mockResolvedValue({});
  mocks.signedUrl.mockResolvedValue("https://test.invalid/private-proof");
});

describe("payments and collection sheet", () => {
  it("validates integer money and logs the selected date in UTC", async () => {
    await logPayment("trip", 11500, "EUR", "BANK", "Deposit", "2026-11-01");
    expect(mocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountMinor: 11500,
        currency: "EUR",
        paidOn: new Date("2026-11-01T00:00:00Z"),
      }),
    });
    expect(mocks.tx.activityLog.create).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/me");
    await expect(logPayment("trip", 0.1, "GBP", "BANK", "")).rejects.toThrow();
    await expect(logPayment("trip", 1, "GBP", "INVALID", "")).rejects.toThrow();
    await expect(
      logPayment("trip", 1, "GBP", "BANK", "", "2026-02-30"),
    ).rejects.toThrow();
  });
  it("requires a rate for foreign payments", async () => {
    mocks.tx.trip.findFirstOrThrow.mockResolvedValue({
      currency: "GBP",
      fxRatesJson: null,
    });
    await expect(logPayment("trip", 100, "EUR", "BANK", "")).rejects.toThrow(
      "exchange rate",
    );
    expect(mocks.tx.payment.create).not.toHaveBeenCalled();
  });
  it("only allows the captain to confirm a payment once", async () => {
    await confirmPayment("payment");
    expect(mocks.tx.payment.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment", trip: { familyId: "family" } },
      }),
    );
    expect(mocks.tx.payment.update).toHaveBeenCalled();
    mocks.requireMember.mockResolvedValue({
      member: { id: "other" },
      family: { id: "family" },
    });
    await expect(confirmPayment("payment")).rejects.toThrow("captain");
    mocks.requireMember.mockResolvedValue({
      member: { id: "captain" },
      family: { id: "family" },
    });
    const payment = await mocks.tx.payment.findFirstOrThrow();
    mocks.tx.payment.findFirstOrThrow.mockResolvedValue({
      ...payment,
      confirmedAt: new Date(),
    });
    await expect(confirmPayment("payment")).rejects.toThrow(
      "already confirmed",
    );
  });
  it("reminds guardians about rolled-up shares after confirmed, converted payments", async () => {
    await sendPaymentReminder("trip", "guardian");
    expect(mocks.tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        memberId: "guardian",
        type: "PAYMENT_REMINDER",
        payloadJson: { tripId: "trip", tripTitle: "Trip", amount: "£50.00" },
      }),
    });
    expect(mocks.tx.payment.findMany).toHaveBeenCalledWith({
      where: {
        tripId: "trip",
        fromMemberId: { in: ["guardian", "child"] },
        confirmedAt: { not: null },
      },
    });
  });
  it("routes dependent reminders to their guardian, rejects covered shares and non-captains", async () => {
    mocks.tx.member.findFirstOrThrow.mockResolvedValue({
      id: "child",
      guardianId: "guardian",
      isDependent: true,
    });
    mocks.tx.payment.findMany.mockResolvedValue([]);
    await sendPaymentReminder("trip", "child");
    expect(mocks.tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ memberId: "guardian" }),
    });
    mocks.tx.payment.findMany.mockResolvedValue([
      { amountMinor: 15000, currency: "GBP" },
    ]);
    await expect(sendPaymentReminder("trip", "child")).rejects.toThrow(
      "already covered",
    );
    mocks.requireMember.mockResolvedValue({
      member: { id: "other" },
      family: { id: "family" },
    });
    await expect(sendPaymentReminder("trip", "child")).rejects.toThrow(
      "captain",
    );
  });
  it("records up-front expenses separately from contributions", async () => {
    await logExpense("trip", 10000, "GBP", "Hotel deposit");
    expect(mocks.tx.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: "Hotel deposit",
        paidByMemberId: "captain",
      }),
    });
    expect(mocks.tx.payment.create).not.toHaveBeenCalled();
    await expect(logExpense("trip", 100, "GBP", "")).rejects.toThrow();
  });
  it("re-encodes optional screenshots without cropping and keeps their keys out of public URLs", async () => {
    const png = await sharp({
      create: { width: 40, height: 20, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const data = new FormData();
    data.set(
      "proof",
      new File([new Uint8Array(png)], "receipt.png", { type: "image/png" }),
    );
    await logPayment("trip", 100, "GBP", "BANK", "", "2026-11-01", data);
    const command = mocks.storageSend.mock.calls[0]![0];
    expect(command.input.Key).toBe(
      "payment-proofs/family/captain/generated-id.webp",
    );
    const metadata = await sharp(command.input.Body).metadata();
    expect(metadata).toEqual(
      expect.objectContaining({ width: 40, height: 20, format: "webp" }),
    );
    expect(metadata.exif).toBeUndefined();
    expect(mocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ proofKey: command.input.Key }),
    });
    data.set(
      "proof",
      new File(["not an image"], "receipt.txt", { type: "text/plain" }),
    );
    await expect(
      logPayment("trip", 100, "GBP", "BANK", "", "2026-11-01", data),
    ).rejects.toThrow("screenshot");
  });
  it("deletes an uploaded screenshot if recording the payment fails", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const data = new FormData();
    data.set(
      "proof",
      new File([new Uint8Array(png)], "receipt.png", { type: "image/png" }),
    );
    mocks.tx.payment.create.mockRejectedValue(new Error("Database failed"));
    await expect(
      logPayment("trip", 100, "GBP", "BANK", "", "2026-11-01", data),
    ).rejects.toThrow("Database failed");
    expect(mocks.storageSend.mock.calls[1]![0].constructor.name).toBe(
      "DeleteObjectCommand",
    );
  });
  it("only gives the payer or captain short-lived proof URLs", async () => {
    const payment = await mocks.tx.payment.findFirstOrThrow();
    mocks.tx.payment.findFirstOrThrow.mockResolvedValue({
      ...payment,
      proofKey: "private-key",
    });
    await expect(getPaymentProof("payment")).resolves.toBe(
      "https://test.invalid/private-proof",
    );
    expect(mocks.signedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 300 },
    );
    mocks.requireMember.mockResolvedValue({
      member: { id: "guardian" },
      family: { id: "family" },
    });
    await expect(getPaymentProof("payment")).resolves.toBe(
      "https://test.invalid/private-proof",
    );
    mocks.requireMember.mockResolvedValue({
      member: { id: "other" },
      family: { id: "family" },
    });
    await expect(getPaymentProof("payment")).rejects.toThrow(
      "payer and captain",
    );
  });
});
