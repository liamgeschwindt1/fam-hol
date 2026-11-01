"use client";

import React, { useState, useTransition } from "react";
import {
  addCostCategory,
  updateCostCategory,
  removeCostCategory,
  addCostLine,
  updateCostLine,
  removeCostLine,
  adjustCost,
  spreadShortfall,
  setFxRate,
} from "./cost-actions";
import { PaymentsSection } from "./PaymentsSection";
import { CostSettings } from "./CostSettings";
import { MoneyError, useMoneyAction } from "./MoneyForms";
import { formatMoney as fmt, parseMinor } from "@/lib/costs/money";
import { z } from "zod";
import type { AgeBand } from "@/lib/costs/engine";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CostLineData {
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
}

interface CategoryData {
  id: string;
  name: string;
  sort: number;
  isAccommodation: boolean;
  lines: CostLineData[];
}

interface ExplainStep {
  lineId: string;
  lineLabel: string;
  categoryId: string;
  description: string;
  amountMinor: number;
}

interface MemberCostData {
  memberId: string;
  totalMinor: number;
  byCategory: Record<string, number>;
  byLine: Record<string, number>;
  explain: ExplainStep[];
  nights: number;
}

interface CostOutputData {
  perMember: MemberCostData[];
  totals: {
    estimateMinor: number;
    allocatedMinor: number;
    unallocatedMinor: number;
  };
  warnings: string[];
}

interface PaymentData {
  id: string;
  fromMemberId: string;
  amountMinor: number;
  currency: string;
  method: string;
  note: string | null;
  paidOn: string;
  confirmedAt: string | null;
  hasProof: boolean;
}

interface AdjustmentData {
  id: string;
  memberId: string;
  lineId: string | null;
  categoryId: string | null;
  deltaMinor: number | null;
  overrideMinor: number | null;
  reason: string | null;
}

interface CostsTabProps {
  tripId: string;
  currentMemberId: string;
  isCaptain: boolean;
  tripCurrency: string;
  tripStatus: string;
  categories: CategoryData[];
  costOutput: CostOutputData | null;
  costError: string | null;
  members: {
    id: string;
    name: string;
    householdId: string | null;
    guardianId: string | null;
  }[];
  payments: PaymentData[];
  adjustments: AdjustmentData[];
  fxRates: Record<string, number>;
  ageWeights: Record<AgeBand, number>;
  rooms: { id: string; label: string; memberIds: string[] }[];
  bankDetails: string | null;
  expenses: {
    id: string;
    paidByMemberId: string;
    amountMinor: number;
    currency: string;
    description: string;
  }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASIS_LABELS: Record<string, string> = {
  PER_PERSON_PER_NIGHT: "Per person per night",
  PER_PERSON_FLAT: "Per person (flat)",
  PER_ROOM_PER_NIGHT: "Per room per night",
  SHARED_BY_PERSON_NIGHTS: "Shared by person-nights",
  SHARED_EQUAL: "Shared equally",
  PER_HOUSEHOLD_FLAT: "Per household (flat)",
  PER_PERSON_PER_DAY_FOOD: "Per person per day (food)",
};

const BASIS_OPTIONS = Object.entries(BASIS_LABELS);

const UNIT_OPTIONS: [string, string][] = [
  ["NIGHT", "Night"],
  ["DAY", "Day"],
  ["FLAT", "Flat"],
];

const monoStyle: React.CSSProperties = {
  fontFamily: "var(--font-dm-mono), 'Courier New', monospace",
  fontVariantNumeric: "tabular-nums",
};

const btnStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  fontSize: "var(--text-xs)",
  fontWeight: 500,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  cursor: "pointer",
  borderRadius: "2px",
};

const btnPrimaryStyle: React.CSSProperties = {
  ...btnStyle,
  background: "var(--sea)",
  color: "#fff",
  borderColor: "var(--sea)",
};

const inputStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--text-sm)",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  width: "100%",
  borderRadius: "2px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  color: "var(--text-soft)",
  marginBottom: "var(--space-1)",
  fontWeight: 500,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CostsTab({
  tripId,
  currentMemberId,
  isCaptain,
  tripCurrency,
  tripStatus,
  categories,
  costOutput,
  costError,
  members,
  payments,
  adjustments,
  fxRates,
  ageWeights,
  rooms,
  bankDetails,
  expenses,
}: CostsTabProps) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [addingLineToCat, setAddingLineToCat] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [showFxForm, setShowFxForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [adjustMemberId, setAdjustMemberId] = useState(currentMemberId);

  function runAction(action: () => Promise<unknown>) {
    setActionError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        console.error("Cost action failed", error);
        setActionError(
          error instanceof Error
            ? error.message
            : "The change could not be saved.",
        );
      }
    });
  }

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLine = (id: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const myMemberCost = costOutput?.perMember.find(
    (m) => m.memberId === adjustMemberId,
  );

  const memberShares: Record<string, number> = {};
  if (costOutput) {
    for (const mc of costOutput.perMember) {
      memberShares[mc.memberId] = mc.totalMinor;
    }
  }

  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));

  // No cost data empty state
  if (!costError && !costOutput && categories.length === 0) {
    return (
      <div>
        <EmptyState isCaptain={isCaptain} />
        {isCaptain && (
          <AddCategoryForm
            tripId={tripId}
            show={showAddCategory}
            onToggle={() => setShowAddCategory(!showAddCategory)}
          />
        )}
        <hr
          style={{
            borderTop: "1px solid var(--border)",
            margin: "var(--space-8) 0",
          }}
        />
        <PaymentsSection
          tripId={tripId}
          currentMemberId={currentMemberId}
          isCaptain={isCaptain}
          tripCurrency={tripCurrency}
          tripStatus={tripStatus}
          members={members}
          payments={payments}
          memberShares={memberShares}
          fxRates={fxRates}
          bankDetails={bankDetails}
          expenses={expenses}
        />
      </div>
    );
  }

  return (
    <div>
      <MoneyError error={costError ?? actionError} />
      {/* ── Total estimate ─────────────────────────────────────────── */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <p
          style={{
            ...monoStyle,
            fontSize: "var(--text-xs)",
            color: "var(--text-soft)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: "0 0 var(--space-1) 0",
          }}
        >
          Total estimate
        </p>
        <p
          style={{
            fontFamily: "var(--font-instrument), Georgia, serif",
            fontSize: "var(--text-3xl)",
            fontWeight: 400,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {costOutput
            ? fmt(costOutput.totals.estimateMinor, tripCurrency)
            : "Unavailable"}
          <span
            style={{
              ...monoStyle,
              fontSize: "var(--text-xs)",
              color: "var(--text-soft)",
              marginLeft: "var(--space-2)",
              verticalAlign: "super",
            }}
          >
            {tripCurrency}
          </span>
        </p>
        {costOutput && costOutput.totals.unallocatedMinor !== 0 && (
          <p
            style={{
              ...monoStyle,
              fontSize: "var(--text-xs)",
              color: "var(--sun)",
              margin: "var(--space-2) 0 0 0",
            }}
          >
            {costOutput.totals.unallocatedMinor > 0
              ? "Shortfall: "
              : "Surplus: "}
            {fmt(Math.abs(costOutput.totals.unallocatedMinor), tripCurrency)}
          </p>
        )}
      </div>

      {/* ── Warnings ───────────────────────────────────────────────── */}
      {costOutput && costOutput.warnings.length > 0 && (
        <div
          style={{
            borderLeft: "3px solid var(--sun)",
            padding: "var(--space-3) var(--space-4)",
            marginBottom: "var(--space-6)",
            background: "var(--bg-raised)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--sun)",
              margin: "0 0 var(--space-2) 0",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Warnings
          </p>
          <ul
            style={{
              margin: 0,
              padding: "0 0 0 var(--space-4)",
              fontSize: "var(--text-xs)",
              color: "var(--text-soft)",
            }}
          >
            {costOutput.warnings.map((w, i) => (
              <li key={i} style={{ marginBottom: "var(--space-1)" }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Category breakdown ─────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <h3
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 600,
            margin: "0 0 var(--space-4) 0",
          }}
        >
          Cost breakdown
        </h3>

        {categories.map((cat) => {
          const catTotal = costOutput
            ? costOutput.perMember.reduce(
                (sum, mc) => sum + (mc.byCategory[cat.id] ?? 0),
                0,
              )
            : null;
          const isOpen = expandedCats.has(cat.id);

          return (
            <div
              key={cat.id}
              style={{
                borderBottom: "1px solid var(--border)",
                marginBottom: "var(--space-1)",
              }}
            >
              {/* Category header */}
              <button
                onClick={() => toggleCat(cat.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "var(--space-3) 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text)",
                  fontSize: "var(--text-base)",
                  fontWeight: 500,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      transition:
                        "transform var(--duration-fast) var(--ease-out)",
                      transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                      fontSize: "var(--text-xs)",
                    }}
                  >
                    {"▶"}
                  </span>
                  {cat.name}
                </span>
                <span style={monoStyle}>
                  {catTotal === null
                    ? "Unavailable"
                    : fmt(catTotal, tripCurrency)}
                </span>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div
                  style={{
                    paddingLeft: "var(--space-6)",
                    paddingBottom: "var(--space-3)",
                  }}
                >
                  {editingCat === cat.id && (
                    <EditCategoryInline
                      catId={cat.id}
                      currentName={cat.name}
                      onDone={() => setEditingCat(null)}
                    />
                  )}
                  {/* Captain actions for category */}
                  {isCaptain && editingCat !== cat.id && (
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-2)",
                        marginBottom: "var(--space-3)",
                      }}
                    >
                      <button
                        style={btnStyle}
                        onClick={() => setEditingCat(cat.id)}
                      >
                        Rename
                      </button>
                      <label>
                        <input
                          type="checkbox"
                          checked={cat.isAccommodation}
                          disabled={isPending}
                          onChange={(event) =>
                            runAction(() =>
                              updateCostCategory(
                                cat.id,
                                cat.name,
                                event.target.checked,
                              ),
                            )
                          }
                        />
                        Accommodation (exclude households booking their own
                        stay)
                      </label>
                      <button
                        style={{
                          ...btnStyle,
                          color: "var(--clay)",
                          borderColor: "var(--clay)",
                        }}
                        disabled={isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `Remove category "${cat.name}" and all its lines?`,
                            )
                          ) {
                            runAction(() => removeCostCategory(cat.id));
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Lines */}
                  {cat.lines.length === 0 && (
                    <p
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--text-soft)",
                        fontStyle: "italic",
                        margin: "0 0 var(--space-3) 0",
                      }}
                    >
                      No cost lines yet.
                    </p>
                  )}

                  {cat.lines.map((line) => {
                    const lineExpanded = expandedLines.has(line.id);
                    return (
                      <div
                        key={line.id}
                        style={{
                          borderTop: "1px solid var(--border)",
                          padding: "var(--space-2) 0",
                        }}
                      >
                        {editingLine === line.id ? (
                          <EditLineForm
                            line={line}
                            tripId={tripId}
                            catId={cat.id}
                            tripCurrency={tripCurrency}
                            onDone={() => setEditingLine(null)}
                          />
                        ) : (
                          <>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "var(--space-2)",
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <button
                                  onClick={() => toggleLine(line.id)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text)",
                                    fontSize: "var(--text-sm)",
                                    padding: 0,
                                    textAlign: "left",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "var(--space-2)",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      transform: lineExpanded
                                        ? "rotate(90deg)"
                                        : "rotate(0deg)",
                                      transition:
                                        "transform var(--duration-fast) var(--ease-out)",
                                      display: "inline-block",
                                    }}
                                  >
                                    {"▶"}
                                  </span>
                                  {line.label}
                                </button>
                                <span
                                  style={{
                                    fontSize: "var(--text-xs)",
                                    color: "var(--text-soft)",
                                    marginLeft: "var(--space-6)",
                                  }}
                                >
                                  {BASIS_LABELS[line.basis] ?? line.basis}
                                  {line.basis === "PER_PERSON_PER_DAY_FOOD" &&
                                    line.mealsPerDay != null &&
                                    ` (${line.mealsPerDay} meals/day)`}
                                  {line.applyAgeWeights && " · age-weighted"}
                                </span>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "var(--space-3)",
                                }}
                              >
                                <span
                                  style={{
                                    ...monoStyle,
                                    fontSize: "var(--text-sm)",
                                  }}
                                >
                                  {fmt(line.amountMinor, line.currency)}
                                </span>
                                {isCaptain && (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "var(--space-1)",
                                    }}
                                  >
                                    <button
                                      style={{
                                        ...btnStyle,
                                        fontSize: "11px",
                                        padding: "2px 6px",
                                      }}
                                      onClick={() => setEditingLine(line.id)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      style={{
                                        ...btnStyle,
                                        fontSize: "11px",
                                        padding: "2px 6px",
                                        color: "var(--clay)",
                                        borderColor: "var(--clay)",
                                      }}
                                      disabled={isPending}
                                      onClick={() => {
                                        runAction(() =>
                                          removeCostLine(line.id),
                                        );
                                      }}
                                    >
                                      Del
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Per-member split for line */}
                            {lineExpanded && costOutput && (
                              <div
                                style={{
                                  marginTop: "var(--space-2)",
                                  marginLeft: "var(--space-6)",
                                  fontSize: "var(--text-xs)",
                                }}
                              >
                                {costOutput.perMember
                                  .filter(
                                    (mc) => (mc.byLine[line.id] ?? 0) !== 0,
                                  )
                                  .map((mc) => (
                                    <div
                                      key={mc.memberId}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "2px 0",
                                        borderBottom: "1px solid var(--border)",
                                      }}
                                    >
                                      <span
                                        style={{ color: "var(--text-soft)" }}
                                      >
                                        {memberNameMap.get(mc.memberId) ??
                                          mc.memberId}
                                      </span>
                                      <span style={monoStyle}>
                                        {fmt(
                                          mc.byLine[line.id] ?? 0,
                                          tripCurrency,
                                        )}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            )}

                            {line.note && (
                              <p
                                style={{
                                  fontSize: "var(--text-xs)",
                                  color: "var(--text-soft)",
                                  fontStyle: "italic",
                                  margin: "var(--space-1) 0 0 var(--space-6)",
                                }}
                              >
                                {line.note}
                              </p>
                            )}
                            {line.url && (
                              <p>
                                <a
                                  href={line.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Cost reference
                                </a>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Add line button */}
                  {isCaptain && (
                    <>
                      {addingLineToCat === cat.id ? (
                        <AddLineForm
                          tripId={tripId}
                          catId={cat.id}
                          tripCurrency={tripCurrency}
                          onDone={() => setAddingLineToCat(null)}
                        />
                      ) : (
                        <button
                          style={{
                            ...btnStyle,
                            marginTop: "var(--space-2)",
                            fontSize: "var(--text-xs)",
                          }}
                          onClick={() => setAddingLineToCat(cat.id)}
                        >
                          + Add cost line
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add category */}
        {isCaptain && (
          <AddCategoryForm
            tripId={tripId}
            show={showAddCategory}
            onToggle={() => setShowAddCategory(!showAddCategory)}
          />
        )}
      </section>

      {/* ── Per-member summary ─────────────────────────────────────── */}
      {costOutput && (
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h3
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 600,
              margin: "0 0 var(--space-4) 0",
            }}
          >
            Per-member summary
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--text-sm)",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid var(--border)",
                    textAlign: "left",
                  }}
                >
                  <th
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      fontWeight: 500,
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      fontWeight: 500,
                      textAlign: "right",
                    }}
                  >
                    Nights
                  </th>
                  <th
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      fontWeight: 500,
                      textAlign: "right",
                    }}
                  >
                    Share
                  </th>
                  <th
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      fontWeight: 500,
                      textAlign: "right",
                    }}
                  >
                    Adjustments
                  </th>
                </tr>
              </thead>
              <tbody>
                {costOutput.perMember.map((mc) => {
                  const adjTotal = mc.explain
                    .filter((s) => s.description.startsWith("Adjustment"))
                    .reduce((sum, s) => sum + s.amountMinor, 0);
                  const isMe = mc.memberId === currentMemberId;

                  return (
                    <tr
                      key={mc.memberId}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: isMe ? "var(--bg-raised)" : undefined,
                      }}
                    >
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                        {memberNameMap.get(mc.memberId) ?? mc.memberId}
                        {isMe && (
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--text-soft)",
                              marginLeft: "var(--space-2)",
                            }}
                          >
                            (you)
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...monoStyle,
                          padding: "var(--space-2) var(--space-3)",
                          textAlign: "right",
                        }}
                      >
                        {mc.nights}
                      </td>
                      <td
                        style={{
                          ...monoStyle,
                          padding: "var(--space-2) var(--space-3)",
                          textAlign: "right",
                          color: mc.totalMinor < 0 ? "var(--clay)" : undefined,
                        }}
                      >
                        {fmt(mc.totalMinor, tripCurrency)}
                      </td>
                      <td
                        style={{
                          ...monoStyle,
                          padding: "var(--space-2) var(--space-3)",
                          textAlign: "right",
                          color:
                            adjTotal !== 0
                              ? adjTotal < 0
                                ? "var(--clay)"
                                : "var(--moss)"
                              : "var(--text-soft)",
                        }}
                      >
                        {adjTotal !== 0
                          ? `${adjTotal > 0 ? "+" : ""}${fmt(adjTotal, tripCurrency)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Member controls (own row) ──────────────────────────────── */}
      {costOutput && myMemberCost && (
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h3
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 600,
              margin: "0 0 var(--space-4) 0",
            }}
          >
            Your share
          </h3>
          <label>
            View or adjust share for
            <select
              value={adjustMemberId}
              onChange={(event) => setAdjustMemberId(event.target.value)}
            >
              {members
                .filter(
                  (m) =>
                    isCaptain ||
                    m.id === currentMemberId ||
                    m.guardianId === currentMemberId,
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>

          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              marginBottom: "var(--space-4)",
            }}
          >
            <button style={btnStyle} onClick={() => setShowAdjust(!showAdjust)}>
              {showAdjust ? "Cancel" : "Adjust my share"}
            </button>
            <button
              style={btnStyle}
              onClick={() => setShowExplain(!showExplain)}
            >
              {showExplain ? "Hide breakdown" : "How is this worked out?"}
            </button>
          </div>

          {showAdjust && (
            <AdjustForm
              tripId={tripId}
              memberId={adjustMemberId}
              isCaptain={isCaptain}
              categories={categories}
              onDone={() => setShowAdjust(false)}
            />
          )}

          {showExplain && (
            <div
              style={{
                background: "var(--bg-raised)",
                padding: "var(--space-4)",
                marginBottom: "var(--space-4)",
                borderLeft: "3px solid var(--sea)",
              }}
            >
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: "var(--text-soft)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "0 0 var(--space-3) 0",
                }}
              >
                Calculation breakdown
              </p>
              {myMemberCost.explain.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "var(--space-1) 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  <span style={{ color: "var(--text-soft)", flex: 1 }}>
                    {step.description}
                  </span>
                  <span
                    style={{
                      ...monoStyle,
                      marginLeft: "var(--space-4)",
                      color: step.amountMinor < 0 ? "var(--clay)" : undefined,
                    }}
                  >
                    {step.amountMinor >= 0 ? "+" : ""}
                    {fmt(step.amountMinor, tripCurrency)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "var(--space-2) 0 0 0",
                  fontWeight: 600,
                  fontSize: "var(--text-sm)",
                }}
              >
                <span>Total</span>
                <span style={monoStyle}>
                  {fmt(myMemberCost.totalMinor, tripCurrency)}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Captain controls ───────────────────────────────────────── */}
      {isCaptain && (
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h3
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 600,
              margin: "0 0 var(--space-4) 0",
            }}
          >
            Captain controls
          </h3>

          <div
            style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}
          >
            {costOutput && costOutput.totals.unallocatedMinor > 0 && (
              <button
                style={btnPrimaryStyle}
                disabled={isPending}
                onClick={() => {
                  runAction(() => spreadShortfall(tripId));
                }}
              >
                Spread shortfall (
                {fmt(costOutput.totals.unallocatedMinor, tripCurrency)})
              </button>
            )}

            <button style={btnStyle} onClick={() => setShowFxForm(!showFxForm)}>
              {showFxForm ? "Cancel" : "Set exchange rate"}
            </button>
          </div>

          {showFxForm && (
            <FxRateForm
              tripId={tripId}
              tripCurrency={tripCurrency}
              onDone={() => setShowFxForm(false)}
            />
          )}
          <CostSettings
            tripId={tripId}
            members={members}
            rooms={rooms}
            ageWeights={ageWeights}
            bankDetails={bankDetails}
          />
          {adjustments.length > 0 && (
            <details style={{ marginTop: "var(--space-4)" }}>
              <summary>Adjustment history</summary>
              {adjustments.map((a) => (
                <p key={a.id}>
                  {memberNameMap.get(a.memberId)}:{" "}
                  {a.overrideMinor !== null
                    ? `override ${fmt(a.overrideMinor, tripCurrency)}`
                    : fmt(a.deltaMinor ?? 0, tripCurrency)}
                  {a.reason ? ` — ${a.reason}` : ""}
                </p>
              ))}
            </details>
          )}
        </section>
      )}

      {/* ── Payments section ───────────────────────────────────────── */}
      <hr
        style={{
          borderTop: "1px solid var(--border)",
          margin: "var(--space-8) 0",
        }}
      />
      {costOutput && (
        <PaymentsSection
          tripId={tripId}
          currentMemberId={currentMemberId}
          isCaptain={isCaptain}
          tripCurrency={tripCurrency}
          tripStatus={tripStatus}
          members={members}
          payments={payments}
          memberShares={memberShares}
          fxRates={fxRates}
          bankDetails={bankDetails}
          expenses={expenses}
        />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function EmptyState({ isCaptain }: { isCaptain: boolean }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "var(--space-16) var(--space-6)",
      }}
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        style={{ margin: "0 auto var(--space-4)" }}
      >
        <rect
          x="12"
          y="8"
          width="40"
          height="48"
          rx="2"
          stroke="var(--ink)"
          strokeWidth="1.5"
          fill="none"
        />
        <line
          x1="20"
          y1="20"
          x2="44"
          y2="20"
          stroke="var(--sea)"
          strokeWidth="1.5"
        />
        <line
          x1="20"
          y1="28"
          x2="44"
          y2="28"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <line
          x1="20"
          y1="36"
          x2="36"
          y2="36"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <line
          x1="20"
          y1="44"
          x2="40"
          y2="44"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
      </svg>
      <p
        style={{
          fontFamily: "var(--font-instrument), Georgia, serif",
          fontSize: "var(--text-xl)",
          fontStyle: "italic",
          color: "var(--text-soft)",
          margin: "0 0 var(--space-2) 0",
        }}
      >
        No cost estimate yet
      </p>
      <p
        style={{
          color: "var(--text-soft)",
          margin: 0,
          fontSize: "var(--text-sm)",
        }}
      >
        {isCaptain
          ? "Add a category to start building the cost estimate."
          : "The captain can add a cost estimate."}
      </p>
    </div>
  );
}

function AddCategoryForm({
  tripId,
  show,
  onToggle,
}: {
  tripId: string;
  show: boolean;
  onToggle: () => void;
}) {
  const [error, formAction, pending] = useMoneyAction(async (fd: FormData) => {
    const name = fd.get("name") as string;
    await addCostCategory(
      tripId,
      name.trim(),
      fd.get("isAccommodation") === "on",
    );
    onToggle();
    return null;
  });

  if (!show) {
    return (
      <button
        style={{ ...btnPrimaryStyle, marginTop: "var(--space-3)" }}
        onClick={onToggle}
      >
        + Add category
      </button>
    );
  }

  return (
    <form
      action={formAction}
      style={{
        display: "flex",
        gap: "var(--space-2)",
        alignItems: "end",
        marginTop: "var(--space-3)",
      }}
    >
      <MoneyError error={error} />
      <div style={{ flex: 1 }}>
        <label htmlFor="cat-name" style={labelStyle}>
          Category name
        </label>
        <input
          id="cat-name"
          name="name"
          type="text"
          required
          placeholder="e.g. Accommodation"
          style={inputStyle}
          autoFocus
        />
        <label>
          <input name="isAccommodation" type="checkbox" /> Accommodation
          category
        </label>
      </div>
      <button type="submit" style={btnPrimaryStyle} disabled={pending}>
        Add
      </button>
      <button type="button" style={btnStyle} onClick={onToggle}>
        Cancel
      </button>
    </form>
  );
}

function EditCategoryInline({
  catId,
  currentName,
  onDone,
}: {
  catId: string;
  currentName: string;
  onDone: () => void;
}) {
  const [error, formAction, pending] = useMoneyAction(async (fd: FormData) => {
    const name = fd.get("name") as string;
    if (name.trim() && name.trim() !== currentName) {
      await updateCostCategory(catId, name.trim());
    }
    onDone();
    return null;
  });

  return (
    <form
      action={formAction}
      style={{
        display: "inline-flex",
        gap: "var(--space-2)",
        alignItems: "center",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <MoneyError error={error} />
      <input
        name="name"
        type="text"
        defaultValue={currentName}
        required
        style={{ ...inputStyle, width: "180px" }}
        autoFocus
      />
      <button
        type="submit"
        disabled={pending}
        style={{ ...btnStyle, fontSize: "11px", padding: "2px 6px" }}
      >
        Save
      </button>
      <button
        type="button"
        style={{ ...btnStyle, fontSize: "11px", padding: "2px 6px" }}
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        Cancel
      </button>
    </form>
  );
}

function AddLineForm({
  tripId,
  catId,
  tripCurrency,
  onDone,
}: {
  tripId: string;
  catId: string;
  tripCurrency: string;
  onDone: () => void;
}) {
  const [basis, setBasis] = useState("SHARED_EQUAL");
  const [error, formAction, pending] = useMoneyAction(async (fd: FormData) => {
    const label = fd.get("label") as string;
    const amountStr = fd.get("amount") as string;
    const currency = fd.get("currency") as string;
    const basisVal = fd.get("basis") as string;
    const unit = fd.get("unit") as string;
    const ageWeights = fd.get("ageWeights") === "on";
    const mealsStr = fd.get("mealsPerDay") as string | null;

    const amountMinor = parseMinor(amountStr);

    await addCostLine(tripId, catId, {
      label: label.trim(),
      amountMinor,
      currency: z
        .enum(["GBP", "EUR"])
        .parse((currency || tripCurrency).toUpperCase()),
      basis: basisVal as
        | "PER_PERSON_PER_NIGHT"
        | "PER_PERSON_FLAT"
        | "PER_ROOM_PER_NIGHT"
        | "SHARED_BY_PERSON_NIGHTS"
        | "SHARED_EQUAL"
        | "PER_HOUSEHOLD_FLAT"
        | "PER_PERSON_PER_DAY_FOOD",
      unit: unit as "NIGHT" | "DAY" | "FLAT",
      applyAgeWeights: ageWeights,
      mealsPerDay: mealsStr ? parseInt(mealsStr, 10) : undefined,
      note: String(fd.get("note") ?? "").trim() || undefined,
      url: String(fd.get("url") ?? "").trim() || undefined,
    });
    onDone();
    return null;
  });

  return (
    <form
      action={formAction}
      style={{
        borderTop: "1px solid var(--border)",
        padding: "var(--space-3) 0",
        display: "grid",
        gap: "var(--space-3)",
        gridTemplateColumns: "1fr 1fr",
      }}
    >
      <MoneyError error={error} />
      <div>
        <label htmlFor="line-label" style={labelStyle}>
          Label
        </label>
        <input
          id="line-label"
          name="label"
          type="text"
          required
          placeholder="e.g. Villa rental"
          style={inputStyle}
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="line-amount" style={labelStyle}>
          Amount
        </label>
        <input
          id="line-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0.00"
          style={{ ...inputStyle, ...monoStyle }}
        />
      </div>
      <div>
        <label htmlFor="line-currency" style={labelStyle}>
          Currency
        </label>
        <input
          id="line-currency"
          name="currency"
          type="text"
          defaultValue={tripCurrency}
          maxLength={3}
          style={{ ...inputStyle, textTransform: "uppercase" }}
        />
      </div>
      <div>
        <label htmlFor="line-basis" style={labelStyle}>
          Basis
        </label>
        <select
          id="line-basis"
          name="basis"
          style={inputStyle}
          value={basis}
          onChange={(e) => setBasis(e.target.value)}
        >
          {BASIS_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="line-unit" style={labelStyle}>
          Unit
        </label>
        <select id="line-unit" name="unit" style={inputStyle}>
          {UNIT_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {basis === "PER_PERSON_PER_DAY_FOOD" && (
        <div>
          <label htmlFor="line-meals" style={labelStyle}>
            Meals per day
          </label>
          <input
            id="line-meals"
            name="mealsPerDay"
            type="number"
            min="1"
            max="10"
            defaultValue={3}
            style={{ ...inputStyle, ...monoStyle }}
          />
        </div>
      )}
      <label>
        Note <input name="note" maxLength={500} style={inputStyle} />
      </label>
      <label>
        Link <input name="url" type="url" style={inputStyle} />
      </label>
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
      >
        <input
          id="line-ageweights"
          name="ageWeights"
          type="checkbox"
          defaultChecked
        />
        <label
          htmlFor="line-ageweights"
          style={{ fontSize: "var(--text-xs)", color: "var(--text-soft)" }}
        >
          Apply age weights
        </label>
      </div>
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          gap: "var(--space-2)",
          justifyContent: "flex-end",
        }}
      >
        <button type="button" style={btnStyle} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" style={btnPrimaryStyle} disabled={pending}>
          Add line
        </button>
      </div>
    </form>
  );
}

function EditLineForm({
  line,
  tripId: _tripId,
  catId: _catId,
  tripCurrency,
  onDone,
}: {
  line: CostLineData;
  tripId: string;
  catId: string;
  tripCurrency: string;
  onDone: () => void;
}) {
  const [basis, setBasis] = useState(line.basis);
  const [error, formAction, pending] = useMoneyAction(async (fd: FormData) => {
    const label = fd.get("label") as string;
    const amountStr = fd.get("amount") as string;
    const currency = fd.get("currency") as string;
    const basisVal = fd.get("basis") as string;
    const unit = fd.get("unit") as string;
    const ageWeights = fd.get("ageWeights") === "on";
    const mealsStr = fd.get("mealsPerDay") as string | null;

    const amountMinor = parseMinor(amountStr);

    await updateCostLine(line.id, {
      label: label.trim(),
      amountMinor,
      currency: z
        .enum(["GBP", "EUR"])
        .parse((currency || tripCurrency).toUpperCase()),
      basis: basisVal as
        | "PER_PERSON_PER_NIGHT"
        | "PER_PERSON_FLAT"
        | "PER_ROOM_PER_NIGHT"
        | "SHARED_BY_PERSON_NIGHTS"
        | "SHARED_EQUAL"
        | "PER_HOUSEHOLD_FLAT"
        | "PER_PERSON_PER_DAY_FOOD",
      unit: unit as "NIGHT" | "DAY" | "FLAT",
      applyAgeWeights: ageWeights,
      mealsPerDay: mealsStr ? parseInt(mealsStr, 10) : undefined,
      note: String(fd.get("note") ?? "").trim() || undefined,
      url: String(fd.get("url") ?? "").trim() || undefined,
    });
    onDone();
    return null;
  });

  return (
    <form
      action={formAction}
      style={{
        padding: "var(--space-3) 0",
        display: "grid",
        gap: "var(--space-3)",
        gridTemplateColumns: "1fr 1fr",
      }}
    >
      <MoneyError error={error} />
      <div>
        <label htmlFor={`edit-label-${line.id}`} style={labelStyle}>
          Label
        </label>
        <input
          id={`edit-label-${line.id}`}
          name="label"
          type="text"
          required
          defaultValue={line.label}
          style={inputStyle}
          autoFocus
        />
      </div>
      <div>
        <label htmlFor={`edit-amount-${line.id}`} style={labelStyle}>
          Amount
        </label>
        <input
          id={`edit-amount-${line.id}`}
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={(line.amountMinor / 100).toFixed(2)}
          style={{ ...inputStyle, ...monoStyle }}
        />
      </div>
      <div>
        <label htmlFor={`edit-currency-${line.id}`} style={labelStyle}>
          Currency
        </label>
        <input
          id={`edit-currency-${line.id}`}
          name="currency"
          type="text"
          defaultValue={line.currency}
          maxLength={3}
          style={{ ...inputStyle, textTransform: "uppercase" }}
        />
      </div>
      <div>
        <label htmlFor={`edit-basis-${line.id}`} style={labelStyle}>
          Basis
        </label>
        <select
          id={`edit-basis-${line.id}`}
          name="basis"
          style={inputStyle}
          value={basis}
          onChange={(e) => setBasis(e.target.value)}
        >
          {BASIS_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`edit-unit-${line.id}`} style={labelStyle}>
          Unit
        </label>
        <select
          id={`edit-unit-${line.id}`}
          name="unit"
          defaultValue={line.unit}
          style={inputStyle}
        >
          {UNIT_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {basis === "PER_PERSON_PER_DAY_FOOD" && (
        <div>
          <label htmlFor={`edit-meals-${line.id}`} style={labelStyle}>
            Meals per day
          </label>
          <input
            id={`edit-meals-${line.id}`}
            name="mealsPerDay"
            type="number"
            min="1"
            max="10"
            defaultValue={line.mealsPerDay ?? 3}
            style={{ ...inputStyle, ...monoStyle }}
          />
        </div>
      )}
      <label>
        Note{" "}
        <input
          name="note"
          maxLength={500}
          defaultValue={line.note ?? ""}
          style={inputStyle}
        />
      </label>
      <label>
        Link{" "}
        <input
          name="url"
          type="url"
          defaultValue={line.url ?? ""}
          style={inputStyle}
        />
      </label>
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
      >
        <input
          id={`edit-ageweights-${line.id}`}
          name="ageWeights"
          type="checkbox"
          defaultChecked={line.applyAgeWeights}
        />
        <label
          htmlFor={`edit-ageweights-${line.id}`}
          style={{ fontSize: "var(--text-xs)", color: "var(--text-soft)" }}
        >
          Apply age weights
        </label>
      </div>
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          gap: "var(--space-2)",
          justifyContent: "flex-end",
        }}
      >
        <button type="button" style={btnStyle} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" style={btnPrimaryStyle} disabled={pending}>
          Save
        </button>
      </div>
    </form>
  );
}

function AdjustForm({
  tripId,
  memberId,
  isCaptain: _isCaptain,
  categories,
  onDone,
}: {
  tripId: string;
  memberId: string;
  isCaptain: boolean;
  categories: CategoryData[];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"delta" | "override">("delta");
  const [scope, setScope] = useState("total");
  const [error, formAction, pending] = useMoneyAction(async (fd: FormData) => {
    const amountStr = fd.get("amount") as string;
    const reason = fd.get("reason") as string;
    const amountMinor = parseMinor(amountStr);

    await adjustCost(tripId, memberId, {
      deltaMinor: mode === "delta" ? amountMinor : undefined,
      overrideMinor: mode === "override" ? amountMinor : undefined,
      reason: reason.trim() || undefined,
      lineId: scope.startsWith("line:") ? scope.slice(5) : undefined,
      categoryId: scope.startsWith("category:") ? scope.slice(9) : undefined,
    });
    onDone();
    return null;
  });

  return (
    <form
      action={formAction}
      style={{
        background: "var(--bg-raised)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-4)",
        display: "grid",
        gap: "var(--space-3)",
        gridTemplateColumns: "1fr 1fr",
      }}
    >
      <MoneyError error={error} />
      <label style={{ gridColumn: "1 / -1" }}>
        Adjust
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          style={inputStyle}
        >
          <option value="total">Total share</option>
          {categories.map((cat) => (
            <option key={cat.id} value={`category:${cat.id}`}>
              {cat.name}
            </option>
          ))}
          {categories.flatMap((cat) =>
            cat.lines.map((line) => (
              <option key={line.id} value={`line:${line.id}`}>
                {cat.name}: {line.label}
              </option>
            )),
          )}
        </select>
      </label>
      <div style={{ gridColumn: "1 / -1" }}>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ ...labelStyle, marginBottom: "var(--space-2)" }}>
            Adjustment type
          </legend>
          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <label
              style={{
                fontSize: "var(--text-xs)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
              }}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === "delta"}
                onChange={() => setMode("delta")}
              />
              Add/subtract
            </label>
            <label
              style={{
                fontSize: "var(--text-xs)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
              }}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === "override"}
                onChange={() => setMode("override")}
              />
              Override total
            </label>
          </div>
        </fieldset>
      </div>
      <div>
        <label htmlFor="adj-amount" style={labelStyle}>
          {mode === "delta" ? "Amount (+/-)" : "New total"}
        </label>
        <input
          id="adj-amount"
          name="amount"
          type="number"
          step="0.01"
          required
          placeholder="0.00"
          style={{ ...inputStyle, ...monoStyle }}
        />
      </div>
      <div>
        <label htmlFor="adj-reason" style={labelStyle}>
          Reason
        </label>
        <input
          id="adj-reason"
          name="reason"
          type="text"
          placeholder="Optional"
          style={inputStyle}
        />
      </div>
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          gap: "var(--space-2)",
          justifyContent: "flex-end",
        }}
      >
        <button type="button" style={btnStyle} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" style={btnPrimaryStyle} disabled={pending}>
          Apply adjustment
        </button>
      </div>
    </form>
  );
}

function FxRateForm({
  tripId,
  tripCurrency,
  onDone,
}: {
  tripId: string;
  tripCurrency: string;
  onDone: () => void;
}) {
  const [error, formAction, pending] = useMoneyAction(async (fd: FormData) => {
    const currency = (fd.get("currency") as string).toUpperCase().trim();
    const rateStr = fd.get("rate") as string;
    const rate = parseFloat(rateStr);

    await setFxRate(tripId, { [currency]: rate }, new Date().toISOString());
    onDone();
    return null;
  });

  return (
    <form
      action={formAction}
      style={{
        marginTop: "var(--space-3)",
        display: "flex",
        gap: "var(--space-2)",
        alignItems: "end",
        flexWrap: "wrap",
      }}
    >
      <MoneyError error={error} />
      <div>
        <label htmlFor="fx-currency" style={labelStyle}>
          Currency code
        </label>
        <input
          id="fx-currency"
          name="currency"
          type="text"
          required
          maxLength={3}
          placeholder="EUR"
          style={{ ...inputStyle, width: "80px", textTransform: "uppercase" }}
        />
      </div>
      <div>
        <label htmlFor="fx-rate" style={labelStyle}>
          1 {tripCurrency} =
        </label>
        <input
          id="fx-rate"
          name="rate"
          type="number"
          step="0.0001"
          min="0.0001"
          required
          placeholder="1.15"
          style={{ ...inputStyle, width: "120px", ...monoStyle }}
        />
      </div>
      <button type="submit" style={btnPrimaryStyle} disabled={pending}>
        Set rate
      </button>
      <button type="button" style={btnStyle} onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}
