import type { EngineOutput, MemberCost } from "./engine";
import { currencyAmount, decimal, divide, round, convertMinor } from "./money";

interface PaymentAmount {
  fromMemberId: string;
  amountMinor: number;
  currency: string;
  confirmedAt: string | Date | null;
}

export interface Commitment {
  shareMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  members: MemberCost[];
}

export function memberCommitment(
  output: EngineOutput,
  memberIds: string[],
  payments: PaymentAmount[],
  currency: string,
  rates: Record<string, number>,
): Commitment {
  const members = output.perMember.filter((m) =>
    memberIds.includes(m.memberId),
  );
  const shareMinor = members.reduce((sum, m) => sum + m.totalMinor, 0);
  const paidMinor = payments
    .filter((p) => p.confirmedAt && memberIds.includes(p.fromMemberId))
    .reduce(
      (sum, p) =>
        sum + convertMinor(p.amountMinor, p.currency, currency, rates),
      0,
    );
  return {
    shareMinor,
    paidMinor,
    outstandingMinor: shareMinor - paidMinor,
    members,
  };
}

export function fromTripMinor(
  amountMinor: number,
  tripCurrency: string,
  targetCurrency: string,
  rates: Record<string, number>,
): number {
  return round(
    divide(
      decimal(amountMinor),
      currencyAmount(1, targetCurrency, tripCurrency, rates),
    ),
  );
}

export function commitmentTotals(
  commitments: {
    shareMinor: number;
    paidMinor: number;
    currency: string;
    rates: Record<string, number>;
  }[],
  currency: string,
) {
  const shareMinor = commitments.reduce(
    (sum, c) =>
      sum + fromTripMinor(c.shareMinor, c.currency, currency, c.rates),
    0,
  );
  const paidMinor = commitments.reduce(
    (sum, c) => sum + fromTripMinor(c.paidMinor, c.currency, currency, c.rates),
    0,
  );
  return { shareMinor, paidMinor, outstandingMinor: shareMinor - paidMinor };
}
