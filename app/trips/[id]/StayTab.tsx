"use client";

import { useState, useTransition } from "react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { addStayOption, voteOnStay, chooseStay } from "./stay-actions";

interface StayVote {
  memberId: string;
  value: "UP" | "NEUTRAL" | "DOWN";
}

interface StayOptionData {
  id: string;
  title: string;
  url: string;
  sourceDomain: string | null;
  imageKey: string | null;
  priceNote: string | null;
  totalPriceMinor: number | null;
  currency: string | null;
  nights: number | null;
  rooms: number | null;
  capacity: number | null;
  pros: string | null;
  cons: string | null;
  addedBy: { id: string; name: string; photoKey: string | null };
  votes: StayVote[];
}

interface StayTabProps {
  tripId: string;
  stayOptions: StayOptionData[];
  chosenStayId: string | null;
  memberId: string;
  isCaptain: boolean;
  members: {
    id: string;
    name: string;
    photoKey: string | null;
    isDependent: boolean;
    guardianId: string | null;
  }[];
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-hanken)",
  backgroundColor: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "2px",
  outline: "none",
  minHeight: "40px",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-dm-mono)",
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-soft)",
  display: "block",
  marginBottom: "4px",
};

export function StayTab({
  tripId,
  stayOptions,
  chosenStayId,
  memberId,
  isCaptain,
  members,
}: StayTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      await addStayOption(formData);
      setShowAddForm(false);
    });
  }

  function handleVote(stayOptionId: string, value: "UP" | "NEUTRAL" | "DOWN") {
    startTransition(async () => {
      await voteOnStay(stayOptionId, value);
    });
  }

  function handleChoose(stayOptionId: string) {
    startTransition(async () => {
      await chooseStay(tripId, stayOptionId);
    });
  }

  function handleUnchoose() {
    startTransition(async () => {
      await chooseStay(tripId, null);
    });
  }

  const memberMap = new Map(members.map((m) => [m.id, m]));

  function voteTally(votes: StayVote[]) {
    let up = 0;
    let neutral = 0;
    let down = 0;
    for (const v of votes) {
      if (v.value === "UP") up++;
      else if (v.value === "NEUTRAL") neutral++;
      else down++;
    }
    return { up, neutral, down };
  }

  const voteBtn = (
    stayId: string,
    value: "UP" | "NEUTRAL" | "DOWN",
    label: string,
    color: string,
    isActive: boolean,
  ): React.ReactNode => (
    <button
      type="button"
      onClick={() => handleVote(stayId, value)}
      style={{
        minWidth: 44,
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "0 10px",
        fontSize: "var(--text-xs)",
        fontFamily: "var(--font-dm-mono)",
        backgroundColor: isActive
          ? `color-mix(in srgb, ${color} 15%, transparent)`
          : "transparent",
        color: isActive ? color : "var(--text-soft)",
        border: `1px solid ${isActive ? color : "var(--border)"}`,
        borderRadius: "2px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}>
      {/* Add option button */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        {showAddForm ? (
          <form
            action={handleAdd}
            style={{
              padding: "var(--space-4)",
              border: "1px dashed var(--border)",
            }}
          >
            <input type="hidden" name="tripId" value={tripId} />

            <h3
              style={{
                fontFamily: "var(--font-instrument)",
                fontSize: "var(--text-lg)",
                fontWeight: 400,
                margin: "0 0 var(--space-3) 0",
              }}
            >
              Add a stay option
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-2)",
                marginBottom: "var(--space-2)",
              }}
            >
              <div>
                <label style={labelStyle}>Title</label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Mountain Lodge"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>URL</label>
                <input
                  name="url"
                  required
                  type="url"
                  placeholder="https://..."
                  style={inputStyle}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 80px",
                gap: "var(--space-2)",
                marginBottom: "var(--space-2)",
              }}
            >
              <div>
                <label style={labelStyle}>Price note</label>
                <input
                  name="priceNote"
                  placeholder="e.g. 200/night"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Nights</label>
                <input
                  name="nights"
                  type="number"
                  min={1}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Rooms</label>
                <input
                  name="rooms"
                  type="number"
                  min={1}
                  style={inputStyle}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-2)",
                marginBottom: "var(--space-2)",
              }}
            >
              <div>
                <label style={labelStyle}>Pros</label>
                <textarea
                  name="pros"
                  rows={2}
                  placeholder="One per line"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Cons</label>
                <textarea
                  name="cons"
                  rows={2}
                  placeholder="One per line"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                type="submit"
                style={{
                  minHeight: "40px",
                  padding: "0 16px",
                  fontSize: "var(--text-sm)",
                  fontFamily: "var(--font-hanken)",
                  fontWeight: 500,
                  backgroundColor: "var(--sea)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "2px",
                  cursor: "pointer",
                }}
              >
                Add option
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  minHeight: "40px",
                  padding: "0 16px",
                  fontSize: "var(--text-sm)",
                  fontFamily: "var(--font-hanken)",
                  backgroundColor: "transparent",
                  color: "var(--text-soft)",
                  border: "1px solid var(--border)",
                  borderRadius: "2px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            style={{
              minHeight: "44px",
              padding: "0 20px",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font-hanken)",
              fontWeight: 500,
              backgroundColor: "transparent",
              color: "var(--text-soft)",
              border: "1px dashed var(--border)",
              borderRadius: "2px",
              cursor: "pointer",
            }}
          >
            + Add a stay option
          </button>
        )}
      </div>

      {/* Stay options */}
      {stayOptions.length === 0 && (
        <p
          style={{
            textAlign: "center",
            padding: "var(--space-12) 0",
            color: "var(--text-soft)",
            fontStyle: "italic",
          }}
        >
          No stay options yet. Add one to get the comparison started.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {stayOptions.map((option) => {
          const isChosen = option.id === chosenStayId;
          const tally = voteTally(option.votes);
          const myVote =
            option.votes.find((v) => v.memberId === memberId)?.value ?? null;
          const upVoters = option.votes
            .filter((v) => v.value === "UP")
            .map((v) => memberMap.get(v.memberId))
            .filter(Boolean);

          return (
            <div
              key={option.id}
              style={{
                border: isChosen
                  ? "2px solid var(--moss)"
                  : "1px solid var(--border)",
                padding: "var(--space-4)",
                backgroundColor: isChosen
                  ? "color-mix(in srgb, var(--moss) 5%, var(--paper))"
                  : "var(--paper)",
              }}
            >
              {isChosen && (
                <div
                  style={{
                    fontFamily: "var(--font-dm-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--moss)",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  Chosen stay
                </div>
              )}

              <h3
                style={{
                  fontFamily: "var(--font-instrument)",
                  fontSize: "var(--text-xl)",
                  fontWeight: 400,
                  margin: "0 0 var(--space-1) 0",
                  color: "var(--ink)",
                }}
              >
                {option.title}
              </h3>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-3)",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "var(--font-dm-mono)",
                    fontSize: "11px",
                    color: "var(--sea)",
                    backgroundColor:
                      "color-mix(in srgb, var(--sea) 10%, transparent)",
                    padding: "2px 6px",
                    borderRadius: "2px",
                    textDecoration: "none",
                  }}
                >
                  {option.sourceDomain || "Link"}
                </a>
                {option.priceNote && (
                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono)",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-soft)",
                    }}
                  >
                    {option.priceNote}
                  </span>
                )}
              </div>

              {/* Details */}
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-4)",
                  marginBottom: "var(--space-3)",
                  flexWrap: "wrap",
                }}
              >
                {option.nights != null && (
                  <div>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>
                      Nights
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-dm-mono)",
                        fontSize: "var(--text-sm)",
                        display: "block",
                      }}
                    >
                      {option.nights}
                    </span>
                  </div>
                )}
                {option.rooms != null && (
                  <div>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>
                      Rooms
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-dm-mono)",
                        fontSize: "var(--text-sm)",
                        display: "block",
                      }}
                    >
                      {option.rooms}
                    </span>
                  </div>
                )}
                {option.capacity != null && (
                  <div>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>
                      Sleeps
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-dm-mono)",
                        fontSize: "var(--text-sm)",
                        display: "block",
                      }}
                    >
                      {option.capacity}
                    </span>
                  </div>
                )}
              </div>

              {/* Pros / cons */}
              {(option.pros || option.cons) && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "var(--space-3)",
                    marginBottom: "var(--space-3)",
                  }}
                >
                  {option.pros && (
                    <div>
                      <span
                        style={{
                          ...labelStyle,
                          color: "var(--moss)",
                          marginBottom: 4,
                        }}
                      >
                        Pros
                      </span>
                      {option.pros.split("\n").map((line, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text)",
                            lineHeight: 1.5,
                          }}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                  {option.cons && (
                    <div>
                      <span
                        style={{
                          ...labelStyle,
                          color: "var(--clay)",
                          marginBottom: 4,
                        }}
                      >
                        Cons
                      </span>
                      {option.cons.split("\n").map((line, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text)",
                            lineHeight: 1.5,
                          }}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Voting */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "var(--space-3)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                {voteBtn(
                  option.id,
                  "UP",
                  `+${tally.up}`,
                  "var(--moss)",
                  myVote === "UP",
                )}
                {voteBtn(
                  option.id,
                  "NEUTRAL",
                  `${tally.neutral}`,
                  "var(--sun)",
                  myVote === "NEUTRAL",
                )}
                {voteBtn(
                  option.id,
                  "DOWN",
                  `-${tally.down}`,
                  "var(--clay)",
                  myVote === "DOWN",
                )}

                {/* Voter avatars for upvotes */}
                {upVoters.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      marginLeft: "var(--space-2)",
                    }}
                  >
                    {upVoters.slice(0, 5).map(
                      (m) =>
                        m && (
                          <div
                            key={m.id}
                            style={{ marginLeft: -4 }}
                            title={m.name}
                          >
                            <MemberAvatar
                              name={m.name}
                              photoKey={m.photoKey}
                              size={20}
                            />
                          </div>
                        ),
                    )}
                  </div>
                )}
              </div>

              {/* Added by + captain pick */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "var(--space-3)",
                  gap: "var(--space-2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  <MemberAvatar
                    name={option.addedBy.name}
                    photoKey={option.addedBy.photoKey}
                    size={18}
                  />
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-soft)",
                    }}
                  >
                    Added by {option.addedBy.name}
                  </span>
                </div>

                {isCaptain && (
                  <div>
                    {isChosen ? (
                      <button
                        type="button"
                        onClick={handleUnchoose}
                        style={{
                          minHeight: 32,
                          padding: "0 10px",
                          fontSize: "11px",
                          fontFamily: "var(--font-dm-mono)",
                          letterSpacing: "0.04em",
                          backgroundColor: "transparent",
                          color: "var(--text-soft)",
                          border: "1px solid var(--border)",
                          borderRadius: "2px",
                          cursor: "pointer",
                        }}
                      >
                        Undo pick
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleChoose(option.id)}
                        style={{
                          minHeight: 32,
                          padding: "0 10px",
                          fontSize: "11px",
                          fontFamily: "var(--font-dm-mono)",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          backgroundColor: "var(--sea)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "2px",
                          cursor: "pointer",
                        }}
                      >
                        Pick this
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
