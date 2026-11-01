"use client";

import React, { useState, useTransition } from "react";
import {
  logPayment,
  confirmPayment,
  sendPaymentReminder,
  logExpense,
  getPaymentProof,
} from "./payment-actions";
import { MoneyError, useMoneyAction } from "./MoneyForms";
import {
  formatMoney as fmt,
  parseMinor,
  convertMinor,
} from "@/lib/costs/money";

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface PaymentsSectionProps {
  tripId: string;
  currentMemberId: string;
  isCaptain: boolean;
  tripCurrency: string;
  tripStatus: string;
  members: { id: string; name: string; guardianId: string | null }[];
  payments: PaymentData[];
  memberShares: Record<string, number>;
  fxRates: Record<string, number>;
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

const METHODS = [
  ["BANK", "Bank transfer"],
  ["CASH", "Cash"],
  ["OTHER", "Other"],
];

// ─── Component ──────────────────────────────────────────────────────────────

export function PaymentsSection({
  tripId,
  currentMemberId,
  isCaptain,
  tripCurrency,
  tripStatus,
  members,
  payments,
  memberShares,
  fxRates,
  bankDetails,
  expenses,
}: PaymentsSectionProps) {
  const [showPayForm, setShowPayForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  function runAction(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        console.error("Payment action failed", error);
        setError(
          error instanceof Error
            ? error.message
            : "The payment change could not be saved.",
        );
      }
    });
  }

  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));

  // Confirmed payments per member
  const paidByMember = new Map<string, number>();
  for (const p of payments) {
    if (p.confirmedAt) {
      paidByMember.set(
        p.fromMemberId,
        (paidByMember.get(p.fromMemberId) ?? 0) +
          convertMinor(p.amountMinor, p.currency, tripCurrency, fxRates),
      );
    }
  }

  return (
    <section>
      <MoneyError error={error} />
      {bankDetails && (isCaptain || tripStatus === "CONFIRMED") && (
        <div style={{ marginBottom: "var(--space-4)", whiteSpace: "pre-wrap" }}>
          <h3>Payment instructions</h3>
          <p>{bankDetails}</p>
        </div>
      )}
      <h3
        style={{
          fontSize: "var(--text-lg)",
          fontWeight: 600,
          margin: "0 0 var(--space-4) 0",
        }}
      >
        Payments
      </h3>
      {Object.keys(memberShares).length > 0 && (
        <p>
          Your share:{" "}
          {fmt(
            [
              currentMemberId,
              ...members
                .filter((m) => m.guardianId === currentMemberId)
                .map((m) => m.id),
            ].reduce((sum, id) => sum + (memberShares[id] ?? 0), 0),
            tripCurrency,
          )}
        </p>
      )}

      {/* ── Log a payment form ──────────────────────────────────── */}
      {!showPayForm ? (
        <button style={btnPrimaryStyle} onClick={() => setShowPayForm(true)}>
          Log a payment
        </button>
      ) : (
        <LogPaymentForm
          tripId={tripId}
          tripCurrency={tripCurrency}
          onDone={() => setShowPayForm(false)}
        />
      )}

      {/* ── Captain's collection sheet ─────────────────────────── */}
      {isCaptain && Object.keys(memberShares).length > 0 && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <h4
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              margin: "0 0 var(--space-3) 0",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-soft)",
            }}
          >
            Collection sheet
          </h4>
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
                    Share
                  </th>
                  <th
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      fontWeight: 500,
                      textAlign: "right",
                    }}
                  >
                    Paid
                  </th>
                  <th
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      fontWeight: 500,
                      textAlign: "right",
                    }}
                  >
                    Outstanding
                  </th>
                  <th
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      fontWeight: 500,
                      textAlign: "center",
                    }}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {members
                  .filter((m) => !m.guardianId)
                  .map((m) => {
                    const ids = [
                      m.id,
                      ...members
                        .filter((d) => d.guardianId === m.id)
                        .map((d) => d.id),
                    ];
                    const share = ids.reduce(
                      (sum, id) => sum + (memberShares[id] ?? 0),
                      0,
                    );
                    const paid = ids.reduce(
                      (sum, id) => sum + (paidByMember.get(id) ?? 0),
                      0,
                    );
                    const outstanding = share - paid;

                    return (
                      <tr
                        key={m.id}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td
                          style={{ padding: "var(--space-2) var(--space-3)" }}
                        >
                          {m.name}
                        </td>
                        <td
                          style={{
                            ...monoStyle,
                            padding: "var(--space-2) var(--space-3)",
                            textAlign: "right",
                          }}
                        >
                          {fmt(share, tripCurrency)}
                        </td>
                        <td
                          style={{
                            ...monoStyle,
                            padding: "var(--space-2) var(--space-3)",
                            textAlign: "right",
                            color:
                              paid > 0 ? "var(--moss)" : "var(--text-soft)",
                          }}
                        >
                          {fmt(paid, tripCurrency)}
                        </td>
                        <td
                          style={{
                            ...monoStyle,
                            padding: "var(--space-2) var(--space-3)",
                            textAlign: "right",
                            color:
                              outstanding > 0
                                ? "var(--clay)"
                                : outstanding < 0
                                  ? "var(--moss)"
                                  : "var(--text-soft)",
                          }}
                        >
                          {outstanding > 0
                            ? fmt(outstanding, tripCurrency)
                            : outstanding < 0
                              ? fmt(outstanding, tripCurrency)
                              : "—"}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-2) var(--space-3)",
                            textAlign: "center",
                          }}
                        >
                          {outstanding <= 0 ? (
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                color: "var(--moss)",
                                fontWeight: 500,
                              }}
                            >
                              Settled
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                color: "var(--clay)",
                                fontWeight: 500,
                              }}
                            >
                              Owing
                            </span>
                          )}
                          {outstanding > 0 && (
                            <button
                              style={btnStyle}
                              disabled={isPending || sentTo.has(m.id)}
                              onClick={() =>
                                runAction(async () => {
                                  await sendPaymentReminder(tripId, m.id);
                                  setSentTo(
                                    (previous) => new Set([...previous, m.id]),
                                  );
                                })
                              }
                            >
                              {sentTo.has(m.id)
                                ? "Reminder sent"
                                : "Send reminder"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pending confirmations (captain) ────────────────────── */}
      {isCaptain && payments.some((p) => !p.confirmedAt) && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <h4
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              margin: "0 0 var(--space-3) 0",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-soft)",
            }}
          >
            Pending confirmations
          </h4>
          {payments
            .filter((p) => !p.confirmedAt)
            .map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <span style={{ fontSize: "var(--text-sm)" }}>
                    {memberNameMap.get(p.fromMemberId) ?? p.fromMemberId}
                  </span>
                  <span
                    style={{
                      ...monoStyle,
                      fontSize: "var(--text-sm)",
                      marginLeft: "var(--space-3)",
                    }}
                  >
                    {fmt(p.amountMinor, p.currency)}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-soft)",
                      marginLeft: "var(--space-2)",
                    }}
                  >
                    via {p.method}
                  </span>
                  {p.note && (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--text-soft)",
                        marginLeft: "var(--space-2)",
                        fontStyle: "italic",
                      }}
                    >
                      {"—"} {p.note}
                    </span>
                  )}
                  {p.hasProof &&
                    (isCaptain || p.fromMemberId === currentMemberId) && (
                      <PaymentProof paymentId={p.id} />
                    )}
                </div>
                <button
                  style={{
                    ...btnStyle,
                    color: "var(--moss)",
                    borderColor: "var(--moss)",
                    fontSize: "var(--text-xs)",
                  }}
                  disabled={isPending}
                  onClick={() => {
                    runAction(() => confirmPayment(p.id));
                  }}
                >
                  Confirm
                </button>
              </div>
            ))}
        </div>
      )}

      {/* ── Payment history ────────────────────────────────────── */}
      {payments.length > 0 && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <h4
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              margin: "0 0 var(--space-3) 0",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-soft)",
            }}
          >
            Payment history
          </h4>
          {payments.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-2) 0",
                borderBottom: "1px solid var(--border)",
                fontSize: "var(--text-sm)",
              }}
            >
              <div>
                <span>
                  {memberNameMap.get(p.fromMemberId) ?? p.fromMemberId}
                </span>
                <span
                  style={{
                    color: "var(--text-soft)",
                    margin: "0 var(--space-2)",
                  }}
                >
                  {"—"}
                </span>
                <span style={monoStyle}>{fmt(p.amountMinor, p.currency)}</span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-soft)",
                    marginLeft: "var(--space-2)",
                  }}
                >
                  via {p.method}
                </span>
                {p.note && (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-soft)",
                      marginLeft: "var(--space-2)",
                      fontStyle: "italic",
                    }}
                  >
                    {p.note}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-soft)",
                    ...monoStyle,
                  }}
                >
                  {new Date(p.paidOn).toLocaleDateString()}
                </span>
                {p.confirmedAt ? (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--moss)",
                      fontWeight: 500,
                      padding: "1px 6px",
                      border: "1px solid var(--moss)",
                      borderRadius: "2px",
                    }}
                  >
                    Confirmed
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--sun)",
                      fontWeight: 500,
                      padding: "1px 6px",
                      border: "1px solid var(--sun)",
                      borderRadius: "2px",
                    }}
                  >
                    Pending
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {payments.length === 0 && (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-soft)",
            marginTop: "var(--space-4)",
          }}
        >
          No payments recorded yet.
        </p>
      )}
      <details style={{ marginTop: "var(--space-6)" }}>
        <summary>Expenses paid up front</summary>
        <p>
          Deposits and purchases paid on behalf of the trip. These are not
          contributions and are not counted twice as payments.
        </p>
        {expenses.map((expense) => (
          <p key={expense.id}>
            {memberNameMap.get(expense.paidByMemberId)}: {expense.description} —{" "}
            {fmt(expense.amountMinor, expense.currency)}
          </p>
        ))}
        <ExpenseForm tripId={tripId} tripCurrency={tripCurrency} />
      </details>
    </section>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function LogPaymentForm({
  tripId,
  tripCurrency,
  onDone,
}: {
  tripId: string;
  tripCurrency: string;
  onDone: () => void;
}) {
  const [error, formAction, pending] = useMoneyAction(async (fd: FormData) => {
    const amountStr = fd.get("amount") as string;
    const method = fd.get("method") as string;
    const note = fd.get("note") as string;

    const amountMinor = parseMinor(amountStr);

    await logPayment(
      tripId,
      amountMinor,
      String(fd.get("currency")),
      method,
      (note ?? "").trim(),
      String(fd.get("paidOn")),
      fd,
    );
    onDone();
    return null;
  });

  return (
    <form
      action={formAction}
      style={{
        background: "var(--bg-raised)",
        padding: "var(--space-4)",
        marginTop: "var(--space-3)",
        display: "grid",
        gap: "var(--space-3)",
        gridTemplateColumns: "1fr 1fr",
      }}
    >
      <MoneyError error={error} />
      <label>
        Currency
        <select name="currency" defaultValue={tripCurrency} style={inputStyle}>
          <option value="GBP">GBP</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <label>
        Paid on{" "}
        <input
          name="paidOn"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          style={inputStyle}
        />
      </label>
      <div>
        <label htmlFor="pay-amount" style={labelStyle}>
          Amount
        </label>
        <input
          id="pay-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="0.00"
          style={{ ...inputStyle, ...monoStyle }}
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="pay-method" style={labelStyle}>
          Method
        </label>
        <select
          id="pay-method"
          name="method"
          style={inputStyle}
          defaultValue="BANK"
        >
          {METHODS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label>
          Screenshot (optional, max 12 MB)
          <input
            name="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={inputStyle}
          />
        </label>
        <label htmlFor="pay-note" style={labelStyle}>
          Note (optional)
        </label>
        <input
          id="pay-note"
          name="note"
          type="text"
          placeholder="Reference or memo"
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
          Log payment
        </button>
      </div>
    </form>
  );
}

function PaymentProof({ paymentId }: { paymentId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, action, pending] = useMoneyAction(async () => {
    setUrl(await getPaymentProof(paymentId));
  });
  return (
    <form
      action={action}
      style={{ display: "inline-block", marginLeft: "var(--space-2)" }}
    >
      <MoneyError error={error} />
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          View screenshot (expires in 5 minutes)
        </a>
      ) : (
        <button disabled={pending} style={btnStyle}>
          Load screenshot
        </button>
      )}
    </form>
  );
}

function ExpenseForm({
  tripId,
  tripCurrency,
}: {
  tripId: string;
  tripCurrency: string;
}) {
  const [error, action, pending] = useMoneyAction(async (data) => {
    await logExpense(
      tripId,
      parseMinor(String(data.get("amount"))),
      tripCurrency,
      String(data.get("description")),
    );
  });
  return (
    <form action={action} style={{ display: "grid", gap: "var(--space-3)" }}>
      <MoneyError error={error} />
      <label>
        Description{" "}
        <input
          name="description"
          required
          maxLength={1000}
          style={inputStyle}
        />
      </label>
      <label>
        Amount ({tripCurrency}){" "}
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          style={inputStyle}
        />
      </label>
      <button disabled={pending} style={btnStyle}>
        Record expense
      </button>
    </form>
  );
}
