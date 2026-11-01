import { describe, it, expect } from "vitest";
import {
  calculateCosts,
  type EngineInput,
  type AgeBand,
  type CostLine,
} from "./engine";

// ─── Test helpers ────────────────────────────────────────────────────────────

const DEFAULT_AGE_WEIGHTS: Record<AgeBand, number> = {
  ADULT: 1,
  CHILD_12_17: 1,
  CHILD_5_11: 0.5,
  CHILD_0_4: 0,
};

function makeTrip(
  overrides?: Partial<EngineInput["trip"]>,
): EngineInput["trip"] {
  return {
    id: "trip-1",
    startDate: "2025-07-01",
    endDate: "2025-07-08",
    currency: "GBP",
    fxRates: {},
    ...overrides,
  };
}

function makeMember(
  id: string,
  householdId: string | null = null,
  ageBand: AgeBand = "ADULT",
  guardianId?: string,
) {
  return { id, householdId, ageBand, guardianId };
}

function makeAttendance(
  memberId: string,
  dates: string[],
  status: "IN" | "MAYBE" | "OUT" = "IN",
) {
  return dates.map((date) => ({ memberId, date, status }));
}

function makeLine(overrides?: Partial<CostLine>): CostLine {
  return {
    id: "line-1",
    categoryId: "cat-1",
    label: "Test Line",
    amountMinor: 10000,
    currency: "GBP",
    basis: "SHARED_EQUAL",
    unit: "FLAT" as const,
    applyAgeWeights: false,
    ...overrides,
  };
}

function makeBaseInput(overrides?: Partial<EngineInput>): EngineInput {
  return {
    trip: makeTrip(),
    members: [],
    attendance: [],
    lines: [],
    ageWeights: DEFAULT_AGE_WEIGHTS,
    includeMaybe: false,
    adjustments: [],
    excludedHouseholdIds: [],
    ...overrides,
  };
}

const DATES_5 = [
  "2025-07-01",
  "2025-07-02",
  "2025-07-03",
  "2025-07-04",
  "2025-07-05",
];
const DATES_3 = ["2025-07-01", "2025-07-02", "2025-07-03"];
const DATES_2 = ["2025-07-01", "2025-07-02"];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Cost Splitting Engine", () => {
  describe("M6 regressions", () => {
    it.each(["PER_ROOM_PER_NIGHT", "PER_HOUSEHOLD_FLAT"] as const)(
      "rounds the whole converted %s line, not each room or household independently",
      (basis) => {
        const result = calculateCosts(
          makeBaseInput({
            trip: makeTrip({ fxRates: { EUR: 2 } }),
            members: [makeMember("a", "first"), makeMember("b", "second")],
            attendance: [
              ...makeAttendance("a", DATES_2.slice(0, 1)),
              ...makeAttendance("b", DATES_2.slice(0, 1)),
            ],
            rooms: [
              { id: "a", label: "A", memberIds: ["a"] },
              { id: "b", label: "B", memberIds: ["b"] },
            ],
            lines: [makeLine({ basis, currency: "EUR", amountMinor: 1 })],
          }),
        );
        expect(result.perMember.map((m) => m.totalMinor)).toEqual([1, 0]);
        expect(result.totals).toEqual({
          estimateMinor: 1,
          allocatedMinor: 1,
          unallocatedMinor: 0,
        });
      },
    );
    it("rounds a priced line once rather than charging half a penny to every person", () => {
      const result = calculateCosts(
        makeBaseInput({
          members: [makeMember("b"), makeMember("a")],
          attendance: [
            ...makeAttendance("a", DATES_2),
            ...makeAttendance("b", DATES_2),
          ],
          ageWeights: { ...DEFAULT_AGE_WEIGHTS, ADULT: 0.25 },
          lines: [
            makeLine({
              amountMinor: 1,
              basis: "PER_PERSON_FLAT",
              applyAgeWeights: true,
            }),
          ],
        }),
      );
      expect(result.perMember.map((m) => m.totalMinor)).toEqual([1, 0]);
      expect(result.totals).toEqual({
        estimateMinor: 1,
        allocatedMinor: 1,
        unallocatedMinor: 0,
      });
    });

    it("reports overrides and deltas as shortfall or surplus without reallocating", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b")],
        attendance: [
          ...makeAttendance("a", DATES_2),
          ...makeAttendance("b", DATES_2),
        ],
        lines: [makeLine({ amountMinor: 10000 })],
        adjustments: [
          { memberId: "a", overrideMinor: 2000, reason: "Own transport" },
        ],
      });
      expect(calculateCosts(input).totals).toEqual({
        estimateMinor: 10000,
        allocatedMinor: 7000,
        unallocatedMinor: 3000,
      });
      input.adjustments.push(
        { memberId: "a", deltaMinor: 1500 },
        { memberId: "b", deltaMinor: 1500 },
      );
      expect(calculateCosts(input).totals.unallocatedMinor).toBe(0);
      input.adjustments.push({ memberId: "b", deltaMinor: 1 });
      expect(calculateCosts(input).totals.unallocatedMinor).toBe(-1);
    });

    it("charges rooms by each night’s actual occupants, not absent room members", () => {
      const result = calculateCosts(
        makeBaseInput({
          members: [makeMember("a"), makeMember("b"), makeMember("absent")],
          attendance: [
            ...makeAttendance("a", DATES_2),
            ...makeAttendance("b", DATES_2.slice(0, 1)),
          ],
          lines: [
            makeLine({
              amountMinor: 10000,
              basis: "PER_ROOM_PER_NIGHT",
              unit: "NIGHT",
            }),
          ],
          rooms: [
            {
              id: "room",
              label: "Room",
              memberIds: ["a", "b", "absent", "unknown"],
            },
          ],
        }),
      );
      expect(result.perMember.map((m) => m.totalMinor)).toEqual([
        15000, 0, 5000,
      ]);
      expect(result.totals.estimateMinor).toBe(20000);
    });

    it("uses explicit accommodation categories, even for flat costs", () => {
      const result = calculateCosts(
        makeBaseInput({
          members: [makeMember("a", "own"), makeMember("b", "shared")],
          attendance: [
            ...makeAttendance("a", DATES_2),
            ...makeAttendance("b", DATES_2),
          ],
          excludedHouseholdIds: ["own"],
          accommodationCategoryIds: ["stay"],
          lines: [
            makeLine({
              id: "stay",
              categoryId: "stay",
              basis: "SHARED_EQUAL",
              amountMinor: 10000,
            }),
            makeLine({
              id: "travel",
              categoryId: "travel",
              basis: "PER_PERSON_PER_NIGHT",
              unit: "NIGHT",
              amountMinor: 100,
            }),
          ],
        }),
      );
      expect(result.perMember[0]!.byLine["stay"]).toBeUndefined();
      expect(result.perMember[0]!.byLine["travel"]).toBe(200);
      expect(result.perMember[1]!.byLine["stay"]).toBe(10000);
    });

    it("ignores dates outside the trip window and unknown attendance members", () => {
      const result = calculateCosts(
        makeBaseInput({
          members: [makeMember("a")],
          attendance: [
            ...makeAttendance("a", ["2025-06-30", "2025-07-01", "2025-07-09"]),
            ...makeAttendance("unknown", DATES_2),
          ],
          lines: [
            makeLine({ basis: "PER_PERSON_PER_NIGHT", amountMinor: 100 }),
          ],
        }),
      );
      expect(result.perMember[0]!.nights).toBe(1);
      expect(result.totals.estimateMinor).toBe(100);
    });

    it.each([
      "PER_PERSON_PER_NIGHT",
      "PER_PERSON_FLAT",
      "PER_PERSON_PER_DAY_FOOD",
      "PER_HOUSEHOLD_FLAT",
    ] as const)("keeps money visible with zero eligibility for %s", (basis) => {
      const result = calculateCosts(
        makeBaseInput({ lines: [makeLine({ basis, amountMinor: 500 })] }),
      );
      expect(result.totals).toEqual({
        estimateMinor: 500,
        allocatedMinor: 0,
        unallocatedMinor: 500,
      });
      expect(result.warnings).toHaveLength(1);
    });
    it("warns for empty rooms and zero person-night weights", () => {
      const base = makeBaseInput({
        members: [makeMember("a", null, "CHILD_0_4")],
        attendance: makeAttendance("a", DATES_2),
        lines: [
          makeLine({ basis: "SHARED_BY_PERSON_NIGHTS", applyAgeWeights: true }),
        ],
      });
      expect(calculateCosts(base).totals.unallocatedMinor).toBe(10000);
      base.lines = [makeLine({ basis: "PER_ROOM_PER_NIGHT" })];
      base.rooms = [{ id: "empty", label: "Empty", memberIds: [] }];
      expect(calculateCosts(base).warnings[0]).toContain(
        "no eligible room occupants",
      );
    });
    it("applies category overrides and adjustments to previously unallocated shares", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        lines: [makeLine()],
        adjustments: [
          {
            memberId: "a",
            lineId: "line-1",
            deltaMinor: 100,
            reason: "Donation",
          },
          {
            memberId: "a",
            categoryId: "new",
            overrideMinor: 500,
            reason: "Top up",
          },
          { memberId: "a", categoryId: "cat-1", overrideMinor: 200 },
        ],
      });
      const result = calculateCosts(input);
      expect(result.perMember[0]!.totalMinor).toBe(700);
      expect(result.perMember[0]!.byCategory).toEqual({
        "cat-1": 200,
        new: 500,
      });
      expect(
        result.perMember[0]!.explain.reduce((sum, s) => sum + s.amountMinor, 0),
      ).toBe(700);
      input.adjustments = [
        { memberId: "a", lineId: "missing", deltaMinor: 100 },
      ];
      expect(calculateCosts(input).warnings).toContainEqual(
        expect.stringContaining("unknown line"),
      );
    });
    it("rejects invalid monetary and weight inputs explicitly", () => {
      const base = makeBaseInput({
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_2),
        lines: [makeLine({ applyAgeWeights: true })],
      });
      expect(() =>
        calculateCosts({ ...base, lines: [makeLine({ amountMinor: -1 })] }),
      ).toThrow("negative");
      expect(() =>
        calculateCosts({
          ...base,
          ageWeights: { ...DEFAULT_AGE_WEIGHTS, ADULT: -1 },
        }),
      ).toThrow("weights");
      expect(() =>
        calculateCosts({
          ...base,
          ageWeights: { ...DEFAULT_AGE_WEIGHTS, ADULT: Infinity },
        }),
      ).toThrow("weights");
      expect(() =>
        calculateCosts({
          ...base,
          lines: [
            makeLine({ basis: "PER_PERSON_PER_DAY_FOOD", mealsPerDay: 0 }),
          ],
        }),
      ).toThrow("Meals");
      expect(() =>
        calculateCosts({
          ...base,
          lines: [
            makeLine({ basis: "PER_PERSON_PER_DAY_FOOD", mealsPerDay: 1.5 }),
          ],
        }),
      ).toThrow("Meals");
      for (const adjustment of [
        { memberId: "a" },
        { memberId: "a", deltaMinor: 1, overrideMinor: 2 },
        { memberId: "a", lineId: "line-1", categoryId: "cat-1", deltaMinor: 1 },
        { memberId: "a", deltaMinor: 0.5 },
      ])
        expect(() =>
          calculateCosts({ ...base, adjustments: [adjustment] }),
        ).toThrow();
      expect(() =>
        calculateCosts({
          ...base,
          lines: [
            makeLine({ amountMinor: Number.MAX_SAFE_INTEGER }),
            makeLine({ id: "second", amountMinor: 2 }),
          ],
        }),
      ).toThrow("safe integer");
    });
    it("property-tests the £2,400 allocation over 300 seeded attendance patterns", () => {
      let seed = 781;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      for (let run = 0; run < 300; run++) {
        const members = Array.from(
          { length: 1 + Math.floor(random() * 14) },
          (_, i) => makeMember(`m${i}`),
        );
        const attendance = members.flatMap((m) =>
          makeAttendance(
            m.id,
            DATES_5.filter(() => random() > 0.5),
          ),
        );
        const result = calculateCosts(
          makeBaseInput({
            members,
            attendance,
            lines: [
              makeLine({
                amountMinor: 240000,
                basis: "SHARED_BY_PERSON_NIGHTS",
              }),
            ],
          }),
        );
        const total = result.perMember.reduce(
          (sum, m) => sum + m.totalMinor,
          0,
        );
        expect(total + result.totals.unallocatedMinor).toBe(240000);
        if (attendance.length > 0) expect(total).toBe(240000);
        for (const person of result.perMember) {
          expect(Number.isInteger(person.totalMinor)).toBe(true);
          expect(
            person.explain.reduce((sum, s) => sum + s.amountMinor, 0),
          ).toBe(person.totalMinor);
        }
      }
    });
  });
  // ── 1. SHARED_EQUAL ──────────────────────────────────────────────────────

  describe("SHARED_EQUAL", () => {
    it("splits equally among 3 adults", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b"), makeMember("c")],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_5),
          ...makeAttendance("c", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 30000,
            basis: "SHARED_EQUAL",
          }),
        ],
      });

      const result = calculateCosts(input);
      const costs = result.perMember.map((m) => m.totalMinor);
      expect(costs).toEqual([10000, 10000, 10000]);
      expect(result.totals.allocatedMinor).toBe(30000);
    });
  });

  // ── 2. SHARED_BY_PERSON_NIGHTS ───────────────────────────────────────────

  describe("SHARED_BY_PERSON_NIGHTS", () => {
    it("splits by person-nights proportionally", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b"), makeMember("c")],
        attendance: [
          ...makeAttendance("a", DATES_5), // 5 nights
          ...makeAttendance("b", DATES_3), // 3 nights
          ...makeAttendance("c", DATES_2), // 2 nights
        ],
        lines: [
          makeLine({
            amountMinor: 240000, // 2400.00
            basis: "SHARED_BY_PERSON_NIGHTS",
            unit: "NIGHT",
          }),
        ],
      });

      const result = calculateCosts(input);
      // 10 total person-nights
      // A: 5/10 * 240000 = 120000
      // B: 3/10 * 240000 = 72000
      // C: 2/10 * 240000 = 48000
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      const memberB = result.perMember.find((m) => m.memberId === "b")!;
      const memberC = result.perMember.find((m) => m.memberId === "c")!;

      expect(memberA.totalMinor).toBe(120000);
      expect(memberB.totalMinor).toBe(72000);
      expect(memberC.totalMinor).toBe(48000);
      expect(memberA.totalMinor + memberB.totalMinor + memberC.totalMinor).toBe(
        240000,
      );
    });
  });

  // ── 3. PER_PERSON_PER_NIGHT ──────────────────────────────────────────────

  describe("PER_PERSON_PER_NIGHT", () => {
    it("charges per person per night", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b"), makeMember("c")],
        attendance: [
          ...makeAttendance("a", DATES_5), // 5 nights
          ...makeAttendance("b", DATES_3), // 3 nights
          ...makeAttendance("c", DATES_2), // 2 nights
        ],
        lines: [
          makeLine({
            amountMinor: 5000, // 50.00 per person per night
            basis: "PER_PERSON_PER_NIGHT",
            unit: "NIGHT",
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      const memberB = result.perMember.find((m) => m.memberId === "b")!;
      const memberC = result.perMember.find((m) => m.memberId === "c")!;

      expect(memberA.totalMinor).toBe(25000); // 50 * 5
      expect(memberB.totalMinor).toBe(15000); // 50 * 3
      expect(memberC.totalMinor).toBe(10000); // 50 * 2
    });
  });

  // ── 4. PER_PERSON_FLAT ───────────────────────────────────────────────────

  describe("PER_PERSON_FLAT", () => {
    it("charges flat rate per attendee", () => {
      const input = makeBaseInput({
        members: [
          makeMember("a"),
          makeMember("b"),
          makeMember("c"),
          makeMember("d"),
        ],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_3),
          ...makeAttendance("c", DATES_2),
          ...makeAttendance("d", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 3000, // 30.00 per person
            basis: "PER_PERSON_FLAT",
            unit: "FLAT",
          }),
        ],
      });

      const result = calculateCosts(input);
      for (const m of result.perMember) {
        expect(m.totalMinor).toBe(3000);
      }
      expect(result.totals.allocatedMinor).toBe(12000);
    });
  });

  // ── 5. PER_ROOM_PER_NIGHT ───────────────────────────────────────────────

  describe("PER_ROOM_PER_NIGHT", () => {
    it("splits room cost among occupants", () => {
      const dates4 = ["2025-07-01", "2025-07-02", "2025-07-03", "2025-07-04"];
      const input = makeBaseInput({
        members: [
          makeMember("a"),
          makeMember("b"),
          makeMember("c"),
          makeMember("d"),
        ],
        attendance: [
          ...makeAttendance("a", dates4),
          ...makeAttendance("b", dates4),
          ...makeAttendance("c", dates4),
          ...makeAttendance("d", dates4),
        ],
        lines: [
          makeLine({
            amountMinor: 10000, // 100.00 per room per night
            basis: "PER_ROOM_PER_NIGHT",
            unit: "NIGHT",
          }),
        ],
        rooms: [
          { id: "room-1", label: "Room 1", memberIds: ["a", "b"] },
          { id: "room-2", label: "Room 2", memberIds: ["c", "d"] },
        ],
      });

      const result = calculateCosts(input);
      // Each room: 100 * 4 nights = 400, split 2 ways = 200 each
      for (const m of result.perMember) {
        expect(m.totalMinor).toBe(20000);
      }
    });

    it("warns when no rooms defined", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_5),
        lines: [
          makeLine({
            basis: "PER_ROOM_PER_NIGHT",
            unit: "NIGHT",
          }),
        ],
      });

      const result = calculateCosts(input);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("no rooms defined");
    });
  });

  // ── 6. PER_HOUSEHOLD_FLAT ───────────────────────────────────────────────

  describe("PER_HOUSEHOLD_FLAT", () => {
    it("charges per household", () => {
      const input = makeBaseInput({
        members: [
          makeMember("a", "hh-1"),
          makeMember("b", "hh-1"),
          makeMember("c", "hh-2"),
          makeMember("d", "hh-3"),
        ],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_5),
          ...makeAttendance("c", DATES_5),
          ...makeAttendance("d", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 10000, // 100.00 per household
            basis: "PER_HOUSEHOLD_FLAT",
            unit: "FLAT",
          }),
        ],
      });

      const result = calculateCosts(input);
      // 3 households: hh-1 (a,b), hh-2 (c), hh-3 (d)
      // hh-1: 100 split 2 ways = 50 each
      // hh-2: 100 to c
      // hh-3: 100 to d
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      const memberB = result.perMember.find((m) => m.memberId === "b")!;
      const memberC = result.perMember.find((m) => m.memberId === "c")!;
      const memberD = result.perMember.find((m) => m.memberId === "d")!;

      expect(memberA.totalMinor).toBe(5000);
      expect(memberB.totalMinor).toBe(5000);
      expect(memberC.totalMinor).toBe(10000);
      expect(memberD.totalMinor).toBe(10000);
      expect(result.totals.allocatedMinor).toBe(30000);
    });
  });

  // ── 7. PER_PERSON_PER_DAY_FOOD ──────────────────────────────────────────

  describe("PER_PERSON_PER_DAY_FOOD", () => {
    it("charges per person per day with meals multiplier", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b")],
        attendance: [
          ...makeAttendance("a", DATES_5), // 5 days
          ...makeAttendance("b", DATES_3), // 3 days
        ],
        lines: [
          makeLine({
            amountMinor: 1500, // 15.00 per person per day
            basis: "PER_PERSON_PER_DAY_FOOD",
            unit: "DAY",
            mealsPerDay: 3,
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      const memberB = result.perMember.find((m) => m.memberId === "b")!;

      // A: 15 * 5 * 3 = 225.00
      expect(memberA.totalMinor).toBe(22500);
      // B: 15 * 3 * 3 = 135.00
      expect(memberB.totalMinor).toBe(13500);
    });

    it("defaults mealsPerDay to 1 when not set", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_3),
        lines: [
          makeLine({
            amountMinor: 1500,
            basis: "PER_PERSON_PER_DAY_FOOD",
            unit: "DAY",
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      // 15 * 3 * 1 = 45.00
      expect(memberA.totalMinor).toBe(4500);
    });
  });

  // ── 8. Age weights ──────────────────────────────────────────────────────

  describe("Age weights", () => {
    it("applies age weights when enabled", () => {
      const input = makeBaseInput({
        members: [
          makeMember("adult", null, "ADULT"),
          makeMember("teen", null, "CHILD_12_17"),
          makeMember("child", null, "CHILD_5_11"),
          makeMember("baby", null, "CHILD_0_4"),
        ],
        attendance: [
          ...makeAttendance("adult", DATES_5),
          ...makeAttendance("teen", DATES_5),
          ...makeAttendance("child", DATES_5),
          ...makeAttendance("baby", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 25000, // 250.00 total
            basis: "SHARED_EQUAL",
            applyAgeWeights: true,
          }),
        ],
      });

      const result = calculateCosts(input);
      // Weights: ADULT=1, CHILD_12_17=1, CHILD_5_11=0.5, CHILD_0_4=0
      // Total weight: 1 + 1 + 0.5 + 0 = 2.5
      // Adult: 1/2.5 * 25000 = 10000
      // Teen: 1/2.5 * 25000 = 10000
      // Child: 0.5/2.5 * 25000 = 5000
      // Baby: 0/2.5 * 25000 = 0
      const adult = result.perMember.find((m) => m.memberId === "adult")!;
      const teen = result.perMember.find((m) => m.memberId === "teen")!;
      const child = result.perMember.find((m) => m.memberId === "child")!;
      const baby = result.perMember.find((m) => m.memberId === "baby")!;

      expect(adult.totalMinor).toBe(10000);
      expect(teen.totalMinor).toBe(10000);
      expect(child.totalMinor).toBe(5000);
      expect(baby.totalMinor).toBe(0);
      expect(
        adult.totalMinor + teen.totalMinor + child.totalMinor + baby.totalMinor,
      ).toBe(25000);
    });

    it("applies age weights to PER_PERSON_PER_NIGHT", () => {
      const input = makeBaseInput({
        members: [
          makeMember("adult", null, "ADULT"),
          makeMember("child", null, "CHILD_5_11"),
        ],
        attendance: [
          ...makeAttendance("adult", DATES_5),
          ...makeAttendance("child", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 5000, // 50.00 per person per night
            basis: "PER_PERSON_PER_NIGHT",
            unit: "NIGHT",
            applyAgeWeights: true,
          }),
        ],
      });

      const result = calculateCosts(input);
      const adult = result.perMember.find((m) => m.memberId === "adult")!;
      const child = result.perMember.find((m) => m.memberId === "child")!;

      // Adult: 50 * 5 * 1 = 250
      expect(adult.totalMinor).toBe(25000);
      // Child: 50 * 5 * 0.5 = 125
      expect(child.totalMinor).toBe(12500);
    });
  });

  // ── 9. Age weights disabled ─────────────────────────────────────────────

  describe("Age weights disabled", () => {
    it("charges full amount when applyAgeWeights is false", () => {
      const input = makeBaseInput({
        members: [
          makeMember("adult", null, "ADULT"),
          makeMember("child", null, "CHILD_5_11"),
        ],
        attendance: [
          ...makeAttendance("adult", DATES_5),
          ...makeAttendance("child", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 20000,
            basis: "SHARED_EQUAL",
            applyAgeWeights: false,
          }),
        ],
      });

      const result = calculateCosts(input);
      const adult = result.perMember.find((m) => m.memberId === "adult")!;
      const child = result.perMember.find((m) => m.memberId === "child")!;

      expect(adult.totalMinor).toBe(10000);
      expect(child.totalMinor).toBe(10000);
    });
  });

  // ── 10. Rounding with largest remainder ─────────────────────────────────

  describe("Rounding with largest remainder", () => {
    it("splits 10000 three ways correctly", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b"), makeMember("c")],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_5),
          ...makeAttendance("c", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 10000, // 100.00 split 3 ways
            basis: "SHARED_EQUAL",
          }),
        ],
      });

      const result = calculateCosts(input);
      const amounts = result.perMember.map((m) => m.totalMinor).sort();
      // 10000 / 3 = 3333.33... -> largest remainder gives one person 3334
      expect(amounts).toEqual([3333, 3333, 3334]);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(10000);
    });

    it("handles 7-way split with exact rounding", () => {
      const members = ["a", "b", "c", "d", "e", "f", "g"].map((id) =>
        makeMember(id),
      );
      const input = makeBaseInput({
        members,
        attendance: members.flatMap((m) => makeAttendance(m.id, DATES_5)),
        lines: [
          makeLine({
            amountMinor: 10000,
            basis: "SHARED_EQUAL",
          }),
        ],
      });

      const result = calculateCosts(input);
      const total = result.perMember.reduce((s, m) => s + m.totalMinor, 0);
      expect(total).toBe(10000);
    });
  });

  // ── 11. Currency conversion ─────────────────────────────────────────────

  describe("Currency conversion", () => {
    it("converts EUR line to GBP trip currency", () => {
      const input = makeBaseInput({
        trip: makeTrip({ currency: "GBP", fxRates: { EUR: 1.15 } }),
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_5),
        lines: [
          makeLine({
            amountMinor: 11500, // 115.00 EUR
            currency: "EUR",
            basis: "PER_PERSON_FLAT",
            unit: "FLAT",
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      // 115 EUR / 1.15 = 100 GBP = 10000 minor
      expect(memberA.totalMinor).toBe(10000);
    });

    it("leaves same-currency amounts unchanged", () => {
      const input = makeBaseInput({
        trip: makeTrip({ currency: "GBP", fxRates: { EUR: 1.15 } }),
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_5),
        lines: [
          makeLine({
            amountMinor: 10000,
            currency: "GBP",
            basis: "PER_PERSON_FLAT",
            unit: "FLAT",
          }),
        ],
      });

      const result = calculateCosts(input);
      expect(result.perMember[0]!.totalMinor).toBe(10000);
    });
  });

  // ── 12. Zero eligible ──────────────────────────────────────────────────

  describe("Zero eligible attendees", () => {
    it("emits warning and unallocated for SHARED_EQUAL with no attendees", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: [], // no attendance
        lines: [
          makeLine({
            amountMinor: 10000,
            basis: "SHARED_EQUAL",
          }),
        ],
      });

      const result = calculateCosts(input);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("no eligible attendees");
      expect(result.totals.unallocatedMinor).toBe(10000);
    });

    it("emits warning for SHARED_BY_PERSON_NIGHTS with no attendees", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: [],
        lines: [
          makeLine({
            amountMinor: 50000,
            basis: "SHARED_BY_PERSON_NIGHTS",
            unit: "NIGHT",
          }),
        ],
      });

      const result = calculateCosts(input);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("no eligible attendees"),
      );
      expect(result.totals.unallocatedMinor).toBe(50000);
    });
  });

  // ── 13. MAYBE attendance ────────────────────────────────────────────────

  describe("MAYBE attendance", () => {
    it("includes MAYBE when includeMaybe is true", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: [
          ...makeAttendance("a", DATES_3, "IN"),
          ...makeAttendance("a", DATES_2.slice(0, 1), "MAYBE"), // 1 extra day as MAYBE - but DATES_2[0] overlaps with DATES_3[0]
          { memberId: "a", date: "2025-07-06", status: "MAYBE" },
          { memberId: "a", date: "2025-07-07", status: "MAYBE" },
        ],
        includeMaybe: true,
        lines: [
          makeLine({
            amountMinor: 5000,
            basis: "PER_PERSON_PER_NIGHT",
            unit: "NIGHT",
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      // 3 IN + 2 MAYBE (not counting overlap) = 5 nights
      expect(memberA.nights).toBe(5);
      expect(memberA.totalMinor).toBe(25000);
    });

    it("excludes MAYBE when includeMaybe is false", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: [
          ...makeAttendance("a", DATES_3, "IN"),
          { memberId: "a", date: "2025-07-06", status: "MAYBE" },
          { memberId: "a", date: "2025-07-07", status: "MAYBE" },
        ],
        includeMaybe: false,
        lines: [
          makeLine({
            amountMinor: 5000,
            basis: "PER_PERSON_PER_NIGHT",
            unit: "NIGHT",
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      expect(memberA.nights).toBe(3);
      expect(memberA.totalMinor).toBe(15000);
    });
  });

  // ── 14. Adjustments - delta ─────────────────────────────────────────────

  describe("Adjustments - delta", () => {
    it("adds delta to member total", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b")],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 20000,
            basis: "SHARED_EQUAL",
          }),
        ],
        adjustments: [{ memberId: "a", deltaMinor: 500 }],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      const memberB = result.perMember.find((m) => m.memberId === "b")!;

      expect(memberA.totalMinor).toBe(10500); // 10000 + 500
      expect(memberB.totalMinor).toBe(10000);
    });
  });

  // ── 15. Adjustments - override ──────────────────────────────────────────

  describe("Adjustments - override", () => {
    it("overrides member total", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b")],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 20000,
            basis: "SHARED_EQUAL",
          }),
        ],
        adjustments: [{ memberId: "a", overrideMinor: 5000 }],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      expect(memberA.totalMinor).toBe(5000);
    });
  });

  // ── 16. Adjustments - line level ────────────────────────────────────────

  describe("Adjustments - line level", () => {
    it("applies delta to specific line", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_5),
        lines: [
          makeLine({
            id: "line-1",
            amountMinor: 10000,
            basis: "PER_PERSON_FLAT",
            unit: "FLAT",
          }),
          makeLine({
            id: "line-2",
            categoryId: "cat-2",
            label: "Other",
            amountMinor: 5000,
            basis: "PER_PERSON_FLAT",
            unit: "FLAT",
          }),
        ],
        adjustments: [{ memberId: "a", lineId: "line-1", deltaMinor: -2000 }],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      expect(memberA.byLine["line-1"]).toBe(8000); // 10000 - 2000
      expect(memberA.byLine["line-2"]).toBe(5000);
      expect(memberA.totalMinor).toBe(13000);
    });

    it("overrides specific line amount", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_5),
        lines: [
          makeLine({
            id: "line-1",
            amountMinor: 10000,
            basis: "PER_PERSON_FLAT",
            unit: "FLAT",
          }),
        ],
        adjustments: [{ memberId: "a", lineId: "line-1", overrideMinor: 7500 }],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      expect(memberA.byLine["line-1"]).toBe(7500);
    });
  });

  // ── 17. Adjustments - category level ────────────────────────────────────

  describe("Adjustments - category level", () => {
    it("applies delta to specific category", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_5),
        lines: [
          makeLine({
            id: "line-1",
            categoryId: "cat-1",
            amountMinor: 10000,
            basis: "PER_PERSON_FLAT",
            unit: "FLAT",
          }),
        ],
        adjustments: [{ memberId: "a", categoryId: "cat-1", deltaMinor: 3000 }],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      expect(memberA.byCategory["cat-1"]).toBe(13000);
      expect(memberA.totalMinor).toBe(13000);
    });
  });

  // ── 18. Excluded households ─────────────────────────────────────────────

  describe("Excluded households", () => {
    it("excludes household from accommodation lines only", () => {
      const input = makeBaseInput({
        members: [makeMember("a", "hh-1"), makeMember("b", "hh-2")],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_5),
        ],
        lines: [
          makeLine({
            id: "accom",
            categoryId: "cat-accom",
            label: "Villa",
            amountMinor: 100000,
            basis: "SHARED_BY_PERSON_NIGHTS",
            unit: "NIGHT",
          }),
          makeLine({
            id: "activity",
            categoryId: "cat-activity",
            label: "Ski Pass",
            amountMinor: 20000,
            basis: "SHARED_EQUAL",
            unit: "FLAT",
          }),
        ],
        excludedHouseholdIds: ["hh-1"],
        accommodationCategoryIds: ["cat-accom"],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      const memberB = result.perMember.find((m) => m.memberId === "b")!;

      // Accommodation: only B (100000 all to B)
      expect(memberA.byLine["accom"]).toBeUndefined();
      expect(memberB.byLine["accom"]).toBe(100000);

      // Activity: both A and B equally
      expect(memberA.byLine["activity"]).toBe(10000);
      expect(memberB.byLine["activity"]).toBe(10000);
    });
  });

  // ── 19. Mixed bases ─────────────────────────────────────────────────────

  describe("Mixed bases", () => {
    it("handles multiple lines with different bases", () => {
      const input = makeBaseInput({
        members: [makeMember("a", "hh-1"), makeMember("b", "hh-2")],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_3),
        ],
        lines: [
          makeLine({
            id: "line-shared",
            categoryId: "cat-1",
            label: "Villa",
            amountMinor: 100000,
            basis: "SHARED_BY_PERSON_NIGHTS",
            unit: "NIGHT",
          }),
          makeLine({
            id: "line-flat",
            categoryId: "cat-2",
            label: "Insurance",
            amountMinor: 3000,
            basis: "PER_PERSON_FLAT",
            unit: "FLAT",
          }),
          makeLine({
            id: "line-food",
            categoryId: "cat-3",
            label: "Food",
            amountMinor: 1000,
            basis: "PER_PERSON_PER_DAY_FOOD",
            unit: "DAY",
            mealsPerDay: 2,
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      const memberB = result.perMember.find((m) => m.memberId === "b")!;

      // Villa: 5/(5+3) * 100000 = 62500; 3/8 * 100000 = 37500
      expect(memberA.byLine["line-shared"]).toBe(62500);
      expect(memberB.byLine["line-shared"]).toBe(37500);

      // Insurance: 3000 each
      expect(memberA.byLine["line-flat"]).toBe(3000);
      expect(memberB.byLine["line-flat"]).toBe(3000);

      // Food: A = 1000 * 5 * 2 = 10000; B = 1000 * 3 * 2 = 6000
      expect(memberA.byLine["line-food"]).toBe(10000);
      expect(memberB.byLine["line-food"]).toBe(6000);

      // Totals
      expect(memberA.totalMinor).toBe(62500 + 3000 + 10000);
      expect(memberB.totalMinor).toBe(37500 + 3000 + 6000);
    });
  });

  // ── 20. Empty trip ──────────────────────────────────────────────────────

  describe("Empty trip", () => {
    it("returns zeros with no lines", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_5),
        lines: [],
      });

      const result = calculateCosts(input);
      expect(result.perMember[0]!.totalMinor).toBe(0);
      expect(result.totals.estimateMinor).toBe(0);
      expect(result.totals.allocatedMinor).toBe(0);
      expect(result.totals.unallocatedMinor).toBe(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── 21. Single person ──────────────────────────────────────────────────

  describe("Single person", () => {
    it("assigns everything to the sole attendee", () => {
      const input = makeBaseInput({
        members: [makeMember("solo")],
        attendance: makeAttendance("solo", DATES_5),
        lines: [
          makeLine({
            amountMinor: 50000,
            basis: "SHARED_EQUAL",
          }),
        ],
      });

      const result = calculateCosts(input);
      expect(result.perMember).toHaveLength(1);
      expect(result.perMember[0]!.totalMinor).toBe(50000);
    });

    it("sole attendee gets full SHARED_BY_PERSON_NIGHTS", () => {
      const input = makeBaseInput({
        members: [makeMember("solo")],
        attendance: makeAttendance("solo", DATES_3),
        lines: [
          makeLine({
            amountMinor: 90000,
            basis: "SHARED_BY_PERSON_NIGHTS",
            unit: "NIGHT",
          }),
        ],
      });

      const result = calculateCosts(input);
      expect(result.perMember[0]!.totalMinor).toBe(90000);
    });
  });

  // ── 22. Property: SHARED_BY_PERSON_NIGHTS sums to total ─────────────────

  describe("Property: shares sum to total", () => {
    it("for any random attendance, shares sum exactly to line total", () => {
      // Pseudo-random but deterministic test
      const memberIds = ["m1", "m2", "m3", "m4", "m5"];
      const allDates = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(2025, 6, 1 + i);
        return d.toISOString().slice(0, 10);
      });

      // Deterministic "random" attendance using simple hash
      const attendance: EngineInput["attendance"] = [];
      for (const mid of memberIds) {
        for (const date of allDates) {
          const hash = (mid.charCodeAt(1)! * 31 + date.charCodeAt(9)!) % 3;
          if (hash < 2) {
            attendance.push({ memberId: mid, date, status: "IN" });
          }
        }
      }

      const lineTotal = 123456;
      const input = makeBaseInput({
        members: memberIds.map((id) => makeMember(id)),
        attendance,
        lines: [
          makeLine({
            amountMinor: lineTotal,
            basis: "SHARED_BY_PERSON_NIGHTS",
            unit: "NIGHT",
          }),
        ],
      });

      const result = calculateCosts(input);
      const totalAllocated = result.perMember.reduce(
        (s, m) => s + m.totalMinor,
        0,
      );
      expect(totalAllocated).toBe(lineTotal);
    });
  });

  // ── 23. Explain output ──────────────────────────────────────────────────

  describe("Explain output", () => {
    it("generates explain steps with amounts", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b")],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_3),
        ],
        lines: [
          makeLine({
            id: "villa",
            label: "Villa Mar",
            amountMinor: 240000,
            basis: "SHARED_BY_PERSON_NIGHTS",
            unit: "NIGHT",
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;

      expect(memberA.explain).toHaveLength(1);
      expect(memberA.explain[0]!.lineId).toBe("villa");
      expect(memberA.explain[0]!.lineLabel).toBe("Villa Mar");
      expect(memberA.explain[0]!.description).toContain("Villa Mar");
      expect(memberA.explain[0]!.description).toContain("shared by");
      expect(memberA.explain[0]!.amountMinor).toBe(150000);
    });

    it("includes adjustment explain steps", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_5),
        lines: [
          makeLine({
            amountMinor: 10000,
            basis: "PER_PERSON_FLAT",
            unit: "FLAT",
          }),
        ],
        adjustments: [
          { memberId: "a", deltaMinor: 500, reason: "Early bird discount" },
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      expect(memberA.explain.length).toBe(2);
      const adjStep = memberA.explain[1]!;
      expect(adjStep.description).toContain("Early bird discount");
    });
  });

  // ── 24. Deterministic ──────────────────────────────────────────────────

  describe("Deterministic", () => {
    it("produces identical output for identical input", () => {
      const input = makeBaseInput({
        members: [makeMember("c"), makeMember("a"), makeMember("b")],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_3),
          ...makeAttendance("c", DATES_2),
        ],
        lines: [
          makeLine({
            amountMinor: 100000,
            basis: "SHARED_BY_PERSON_NIGHTS",
            unit: "NIGHT",
          }),
          makeLine({
            id: "line-2",
            categoryId: "cat-2",
            label: "Activity",
            amountMinor: 30000,
            basis: "SHARED_EQUAL",
            unit: "FLAT",
          }),
        ],
      });

      const result1 = calculateCosts(input);
      const result2 = calculateCosts(input);

      expect(result1).toEqual(result2);
    });

    it("output member order is sorted by id", () => {
      const input = makeBaseInput({
        members: [
          makeMember("z-last"),
          makeMember("a-first"),
          makeMember("m-middle"),
        ],
        attendance: [
          ...makeAttendance("z-last", DATES_5),
          ...makeAttendance("a-first", DATES_5),
          ...makeAttendance("m-middle", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 30000,
            basis: "SHARED_EQUAL",
          }),
        ],
      });

      const result = calculateCosts(input);
      expect(result.perMember.map((m) => m.memberId)).toEqual([
        "a-first",
        "m-middle",
        "z-last",
      ]);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("handles member with OUT attendance only", () => {
      const input = makeBaseInput({
        members: [makeMember("a"), makeMember("b")],
        attendance: [
          ...makeAttendance("a", DATES_5, "IN"),
          ...makeAttendance("b", DATES_5, "OUT"),
        ],
        lines: [
          makeLine({
            amountMinor: 10000,
            basis: "SHARED_EQUAL",
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      const memberB = result.perMember.find((m) => m.memberId === "b")!;

      expect(memberA.totalMinor).toBe(10000);
      expect(memberB.totalMinor).toBe(0);
    });

    it("handles all CHILD_0_4 with age weights (total weight 0)", () => {
      const input = makeBaseInput({
        members: [
          makeMember("baby1", null, "CHILD_0_4"),
          makeMember("baby2", null, "CHILD_0_4"),
        ],
        attendance: [
          ...makeAttendance("baby1", DATES_5),
          ...makeAttendance("baby2", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 10000,
            basis: "SHARED_EQUAL",
            applyAgeWeights: true,
          }),
        ],
      });

      const result = calculateCosts(input);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("total weight is zero"),
      );
      expect(result.totals.unallocatedMinor).toBe(10000);
    });

    it("handles adjustment for unknown member", () => {
      const input = makeBaseInput({
        members: [makeMember("a")],
        attendance: makeAttendance("a", DATES_5),
        lines: [],
        adjustments: [{ memberId: "unknown", deltaMinor: 1000 }],
      });

      const result = calculateCosts(input);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("unknown member"),
      );
    });

    it("members with no household are excluded from PER_HOUSEHOLD_FLAT", () => {
      const input = makeBaseInput({
        members: [
          makeMember("a", null), // no household
          makeMember("b", "hh-1"),
        ],
        attendance: [
          ...makeAttendance("a", DATES_5),
          ...makeAttendance("b", DATES_5),
        ],
        lines: [
          makeLine({
            amountMinor: 10000,
            basis: "PER_HOUSEHOLD_FLAT",
            unit: "FLAT",
          }),
        ],
      });

      const result = calculateCosts(input);
      const memberA = result.perMember.find((m) => m.memberId === "a")!;
      const memberB = result.perMember.find((m) => m.memberId === "b")!;

      expect(memberA.totalMinor).toBe(0);
      expect(memberB.totalMinor).toBe(10000);
    });
  });
});
