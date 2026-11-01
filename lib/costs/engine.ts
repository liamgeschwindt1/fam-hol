import {
  add,
  allocate,
  currencyAmount,
  decimal,
  divide,
  formatMoney,
  multiply,
  round,
  type Fraction,
} from "./money";

export type AgeBand = "ADULT" | "CHILD_12_17" | "CHILD_5_11" | "CHILD_0_4";
export type CostBasis =
  | "PER_PERSON_PER_NIGHT"
  | "PER_PERSON_FLAT"
  | "PER_ROOM_PER_NIGHT"
  | "SHARED_BY_PERSON_NIGHTS"
  | "SHARED_EQUAL"
  | "PER_HOUSEHOLD_FLAT"
  | "PER_PERSON_PER_DAY_FOOD";
export type CostUnit = "NIGHT" | "DAY" | "FLAT";

export interface CostLine {
  id: string;
  categoryId: string;
  label: string;
  amountMinor: number;
  currency: string;
  basis: CostBasis;
  unit: CostUnit;
  applyAgeWeights: boolean;
  mealsPerDay?: number;
}

export interface EngineInput {
  trip: {
    id: string;
    startDate: string;
    endDate: string;
    currency: string;
    fxRates: Record<string, number>;
  };
  members: {
    id: string;
    householdId: string | null;
    ageBand: AgeBand;
    guardianId?: string;
  }[];
  attendance: {
    memberId: string;
    date: string;
    status: "IN" | "MAYBE" | "OUT";
  }[];
  lines: CostLine[];
  rooms?: { id: string; label: string; memberIds: string[] }[];
  ageWeights: Record<AgeBand, number>;
  includeMaybe: boolean;
  adjustments: {
    memberId: string;
    lineId?: string;
    categoryId?: string;
    deltaMinor?: number;
    overrideMinor?: number;
    reason?: string;
  }[];
  excludedHouseholdIds: string[];
  accommodationCategoryIds?: string[];
}

export interface ExplainStep {
  lineId: string;
  lineLabel: string;
  categoryId: string;
  description: string;
  amountMinor: number;
}

export interface MemberCost {
  memberId: string;
  totalMinor: number;
  byCategory: Record<string, number>;
  byLine: Record<string, number>;
  nights: number;
  explain: ExplainStep[];
}

export interface EngineOutput {
  perMember: MemberCost[];
  totals: {
    estimateMinor: number;
    allocatedMinor: number;
    unallocatedMinor: number;
  };
  warnings: string[];
}

export function calculateCosts(input: EngineInput): EngineOutput {
  const { trip, lines, ageWeights, adjustments } = input;
  const warnings: string[] = [];
  const dates = new Map(input.members.map((m) => [m.id, new Set<string>()]));
  for (const attendance of input.attendance) {
    if (attendance.date < trip.startDate || attendance.date > trip.endDate)
      continue;
    if (
      attendance.status === "IN" ||
      (input.includeMaybe && attendance.status === "MAYBE")
    ) {
      dates.get(attendance.memberId)?.add(attendance.date);
    }
  }
  const perMember: MemberCost[] = [...input.members]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((m) => ({
      memberId: m.id,
      totalMinor: 0,
      byCategory: {},
      byLine: {},
      nights: dates.get(m.id)!.size,
      explain: [],
    }));
  const costs = new Map(perMember.map((m) => [m.memberId, m]));
  let estimateMinor = 0;

  for (const line of lines) {
    if (line.amountMinor < 0) throw new Error("Cost lines cannot be negative");
    const price = currencyAmount(
      line.amountMinor,
      line.currency,
      trip.currency,
      trip.fxRates,
    );
    const accommodation =
      input.accommodationCategoryIds?.includes(line.categoryId) ?? false;
    const eligible = input.members.filter(
      (m) =>
        dates.get(m.id)!.size > 0 &&
        !(
          accommodation &&
          m.householdId !== null &&
          input.excludedHouseholdIds.includes(m.householdId)
        ),
    );
    const weight = (m: EngineInput["members"][number]) => {
      const value = line.applyAgeWeights ? ageWeights[m.ageBand] : 1;
      if (!Number.isFinite(value) || value < 0)
        throw new Error("Age weights must be finite and non-negative");
      return decimal(value);
    };
    const units = (m: EngineInput["members"][number]) => dates.get(m.id)!.size;

    const record = (
      distributed: Map<string, number>,
      explanation: string | ((id: string) => string),
    ) => {
      for (const [id, amount] of distributed) {
        const member = costs.get(id)!;
        member.byLine[line.id] = (member.byLine[line.id] ?? 0) + amount;
        member.byCategory[line.categoryId] =
          (member.byCategory[line.categoryId] ?? 0) + amount;
        member.totalMinor += amount;
        member.explain.push({
          lineId: line.id,
          lineLabel: line.label,
          categoryId: line.categoryId,
          amountMinor: amount,
          description: `${line.label}: ${typeof explanation === "string" ? explanation : explanation(id)}. You attend ${member.nights} dates. Your share: ${formatMoney(amount, trip.currency)}`,
        });
      }
    };
    const unallocated = (message: string) => {
      estimateMinor += round(price);
      warnings.push(`Line "${line.label}" (${line.id}): ${message}`);
    };

    switch (line.basis) {
      case "PER_PERSON_PER_NIGHT":
      case "PER_PERSON_FLAT":
      case "PER_PERSON_PER_DAY_FOOD": {
        if (eligible.length === 0) {
          unallocated("no eligible attendees");
          break;
        }
        const meals = line.mealsPerDay ?? 1;
        if (!Number.isInteger(meals) || meals < 1)
          throw new Error("Meals per day must be a positive integer");
        const shares = eligible.map((m) => ({
          memberId: m.id,
          amount: multiply(
            price,
            multiply(
              weight(m),
              decimal(
                line.basis === "PER_PERSON_FLAT"
                  ? 1
                  : units(m) *
                      (line.basis === "PER_PERSON_PER_DAY_FOOD" ? meals : 1),
              ),
            ),
          ),
        }));
        estimateMinor += round(
          shares.reduce((sum, s) => add(sum, s.amount), decimal(0)),
        );
        record(allocate(shares), (id) => {
          const member = eligible.find((m) => m.id === id)!;
          const rate =
            line.currency === trip.currency
              ? ""
              : `, converted at 1 ${trip.currency} = ${trip.fxRates[line.currency]} ${line.currency}`;
          return `${formatMoney(line.amountMinor, line.currency)} per person${line.basis === "PER_PERSON_FLAT" ? "" : line.basis === "PER_PERSON_PER_DAY_FOOD" ? ` per day × ${units(member)} days × ${meals} meals/day` : ` per night × ${units(member)} nights`} × age weight ${line.applyAgeWeights ? ageWeights[member.ageBand] : 1}${rate}; rounding is applied once to the line total`;
        });
        break;
      }
      case "SHARED_BY_PERSON_NIGHTS":
      case "SHARED_EQUAL": {
        const factors = eligible.map((m) => ({
          memberId: m.id,
          factor: multiply(
            weight(m),
            decimal(line.basis === "SHARED_EQUAL" ? 1 : units(m)),
          ),
        }));
        const totalWeight = factors.reduce(
          (sum, f) => add(sum, f.factor),
          decimal(0),
        );
        if (totalWeight.numerator === 0n) {
          unallocated(
            eligible.length === 0
              ? "no eligible attendees"
              : "total weight is zero",
          );
          break;
        }
        const total = round(price);
        estimateMinor += total;
        record(
          allocate(
            factors.map((f) => ({
              memberId: f.memberId,
              amount: multiply(decimal(total), divide(f.factor, totalWeight)),
            })),
          ),
          (id) => {
            const factor = factors.find((f) => f.memberId === id)!.factor;
            return `${formatMoney(total, trip.currency)} shared ${line.basis === "SHARED_EQUAL" ? "equally" : "by person-nights"} across ${eligible.length} attendees. Your weighted units: ${Number(factor.numerator) / Number(factor.denominator)} of ${Number(totalWeight.numerator) / Number(totalWeight.denominator)}`;
          },
        );
        break;
      }
      case "PER_ROOM_PER_NIGHT": {
        if (!input.rooms?.length) {
          unallocated("no rooms defined");
          break;
        }
        let usedRooms = 0;
        const amounts = new Map<string, Fraction>();
        const explanations = new Map<string, string[]>();
        for (const room of input.rooms) {
          const occupants = eligible.filter((m) =>
            room.memberIds.includes(m.id),
          );
          const roomDates = new Set(
            occupants.flatMap((m) => [...dates.get(m.id)!]),
          );
          if (roomDates.size === 0) continue;
          usedRooms++;
          // A room is charged once per occupied night; only that night's occupants pay.
          for (const m of occupants) {
            let factor = decimal(0);
            for (const date of dates.get(m.id)!) {
              factor = add(
                factor,
                divide(
                  decimal(1),
                  decimal(
                    occupants.filter((other) => dates.get(other.id)!.has(date))
                      .length,
                  ),
                ),
              );
            }
            amounts.set(
              m.id,
              add(amounts.get(m.id) ?? decimal(0), multiply(price, factor)),
            );
            const notes = explanations.get(m.id) ?? [];
            notes.push(
              `${room.label}, ${formatMoney(line.amountMinor, line.currency)}/night × ${roomDates.size} occupied nights, split by occupants each night; your occupancy factor is ${Number(factor.numerator) / Number(factor.denominator)}`,
            );
            explanations.set(m.id, notes);
          }
        }
        if (usedRooms === 0) unallocated("no eligible room occupants");
        else {
          const shares = [...amounts].map(([memberId, amount]) => ({
            memberId,
            amount,
          }));
          estimateMinor += round(
            shares.reduce((sum, s) => add(sum, s.amount), decimal(0)),
          );
          record(allocate(shares), (id) => explanations.get(id)!.join("; "));
        }
        break;
      }
      case "PER_HOUSEHOLD_FLAT": {
        const households = new Set(
          eligible.map((m) => m.householdId).filter((id) => id !== null),
        );
        if (households.size === 0) {
          unallocated("no eligible households");
          break;
        }
        const shares: { memberId: string; amount: Fraction }[] = [];
        const counts = new Map<string, number>();
        for (const household of households) {
          const attendees = eligible.filter((m) => m.householdId === household);
          for (const m of attendees) {
            shares.push({
              memberId: m.id,
              amount: divide(price, decimal(attendees.length)),
            });
            counts.set(m.id, attendees.length);
          }
        }
        estimateMinor += round(
          shares.reduce((sum, s) => add(sum, s.amount), decimal(0)),
        );
        record(
          allocate(shares),
          (id) =>
            `${formatMoney(line.amountMinor, line.currency)}/household, split among ${counts.get(id)} attending members`,
        );
        break;
      }
    }
  }

  for (const adjustment of adjustments) {
    const member = costs.get(adjustment.memberId);
    if (!member) {
      warnings.push(`Adjustment for unknown member ${adjustment.memberId}`);
      continue;
    }
    const line = lines.find((l) => l.id === adjustment.lineId);
    if (adjustment.lineId && !line) {
      warnings.push(`Adjustment for unknown line ${adjustment.lineId}`);
      continue;
    }
    const hasDelta = adjustment.deltaMinor !== undefined;
    const hasOverride = adjustment.overrideMinor !== undefined;
    if (
      hasDelta === hasOverride ||
      (adjustment.lineId && adjustment.categoryId)
    ) {
      throw new Error("Choose one adjustment amount and one scope");
    }
    const amount = adjustment.overrideMinor ?? adjustment.deltaMinor!;
    if (!Number.isSafeInteger(amount))
      throw new Error("Adjustments must be integer minor units");
    const current = line
      ? (member.byLine[line.id] ?? 0)
      : adjustment.categoryId
        ? (member.byCategory[adjustment.categoryId] ?? 0)
        : member.totalMinor;
    const diff = hasOverride ? amount - current : amount;
    if (line) {
      member.byLine[line.id] = current + diff;
      member.byCategory[line.categoryId] =
        (member.byCategory[line.categoryId] ?? 0) + diff;
    } else if (adjustment.categoryId) {
      member.byCategory[adjustment.categoryId] = current + diff;
    }
    member.totalMinor += diff;
    member.explain.push({
      lineId: line?.id ?? "",
      lineLabel: line?.label ?? (adjustment.categoryId ? "Category" : "Total"),
      categoryId: line?.categoryId ?? adjustment.categoryId ?? "",
      amountMinor: diff,
      description: `Adjustment${adjustment.reason ? ` (${adjustment.reason})` : ""}: ${hasOverride ? `override to ${formatMoney(amount, trip.currency)}` : `${diff >= 0 ? "+" : ""}${formatMoney(diff, trip.currency)}`}`,
    });
  }
  const allocatedMinor = perMember.reduce((sum, m) => sum + m.totalMinor, 0);
  if (
    ![
      estimateMinor,
      allocatedMinor,
      ...perMember.map((m) => m.totalMinor),
    ].every(Number.isSafeInteger)
  ) {
    throw new Error("Money exceeds the safe integer range");
  }
  return {
    perMember,
    totals: {
      estimateMinor,
      allocatedMinor,
      unallocatedMinor: estimateMinor - allocatedMinor,
    },
    warnings,
  };
}
