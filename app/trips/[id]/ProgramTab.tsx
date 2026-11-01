"use client";

import { useState, useTransition } from "react";
import {
  addProgramItem,
  updateProgramItem,
  removeProgramItem,
} from "./program-actions";

interface ProgramItem {
  id: string;
  date: string;
  time: string | null;
  title: string;
  notes: string | null;
  placeName: string | null;
  url: string | null;
  sort: number;
}

interface ProgramTabProps {
  tripId: string;
  startDate: string | null;
  endDate: string | null;
  items: ProgramItem[];
  isCaptain: boolean;
}

function getDays(start: string | null, end: string | null): string[] {
  if (!start || !end) return [];
  const days: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  const cur = new Date(s);
  while (cur <= e) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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

export function ProgramTab({
  tripId,
  startDate,
  endDate,
  items,
  isCaptain,
}: ProgramTabProps) {
  const days = getDays(startDate, endDate);
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Group items by date
  const grouped = new Map<string, ProgramItem[]>();
  for (const item of items) {
    const dateKey = item.date.slice(0, 10);
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(item);
  }

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      await addProgramItem(formData);
      setAddingForDate(null);
    });
  }

  function handleUpdate(formData: FormData) {
    startTransition(async () => {
      await updateProgramItem(formData);
      setEditingId(null);
    });
  }

  function handleRemove(itemId: string) {
    if (!confirm("Remove this item?")) return;
    const fd = new FormData();
    fd.set("itemId", itemId);
    startTransition(async () => {
      await removeProgramItem(fd);
    });
  }

  return (
    <div style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}>
      {!days.length && (
        <p style={{ color: "var(--text-soft)", fontStyle: "italic" }}>
          Add trip dates before planning day-by-day activities.
        </p>
      )}
      {days.map((day) => {
        const dayItems = grouped.get(day) ?? [];
        return (
          <div key={day} style={{ marginBottom: "var(--space-6)" }}>
            <h3
              style={{
                fontFamily: "var(--font-instrument)",
                fontSize: "var(--text-lg)",
                fontWeight: 400,
                margin: "0 0 var(--space-3) 0",
                paddingBottom: "var(--space-2)",
                borderBottom: "1px solid var(--border)",
                color: "var(--ink)",
              }}
            >
              {formatDayHeader(day)}
            </h3>

            {dayItems.length === 0 && !isCaptain && (
              <p
                style={{
                  color: "var(--text-soft)",
                  fontStyle: "italic",
                  fontSize: "var(--text-sm)",
                  margin: "var(--space-2) 0",
                }}
              >
                Nothing planned yet.
              </p>
            )}

            {dayItems.map((item) =>
              editingId === item.id && isCaptain ? (
                <form
                  key={item.id}
                  action={handleUpdate}
                  style={{
                    padding: "var(--space-3)",
                    border: "1px solid var(--border)",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  <input type="hidden" name="itemId" value={item.id} />
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 100px",
                      gap: "var(--space-2)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Title</label>
                      <input
                        name="title"
                        defaultValue={item.title}
                        required
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Time</label>
                      <input
                        name="time"
                        defaultValue={item.time ?? ""}
                        placeholder="09:00"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: "var(--space-2)" }}>
                    <label style={labelStyle}>Notes</label>
                    <textarea
                      name="notes"
                      defaultValue={item.notes ?? ""}
                      rows={2}
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
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
                      <label style={labelStyle}>Location</label>
                      <input
                        name="placeName"
                        defaultValue={item.placeName ?? ""}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Link</label>
                      <input
                        name="url"
                        defaultValue={item.url ?? ""}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-2)",
                    }}
                  >
                    <button
                      type="submit"
                      style={{
                        minHeight: "36px",
                        padding: "0 14px",
                        fontSize: "var(--text-xs)",
                        fontFamily: "var(--font-hanken)",
                        fontWeight: 500,
                        backgroundColor: "var(--sea)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "2px",
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      style={{
                        minHeight: "36px",
                        padding: "0 14px",
                        fontSize: "var(--text-xs)",
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
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) 0",
                    borderBottom: "1px solid var(--border)",
                    alignItems: "flex-start",
                  }}
                >
                  {/* Time */}
                  <div
                    style={{
                      minWidth: 52,
                      fontFamily: "var(--font-dm-mono)",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-soft)",
                      paddingTop: 2,
                    }}
                  >
                    {item.time || "--:--"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: "var(--text-sm)",
                        color: "var(--ink)",
                      }}
                    >
                      {item.title}
                    </div>
                    {item.notes && (
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-soft)",
                          marginTop: 2,
                        }}
                      >
                        {item.notes}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-3)",
                        marginTop: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      {item.placeName && (
                        <span
                          style={{
                            fontFamily: "var(--font-dm-mono)",
                            fontSize: "11px",
                            color: "var(--text-soft)",
                          }}
                        >
                          {item.placeName}
                        </span>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: "var(--font-dm-mono)",
                            fontSize: "11px",
                            color: "var(--sea)",
                          }}
                        >
                          Link
                        </a>
                      )}
                    </div>
                  </div>

                  {isCaptain && (
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-1)",
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setEditingId(item.id)}
                        style={{
                          minWidth: 36,
                          minHeight: 36,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "none",
                          border: "1px solid var(--border)",
                          borderRadius: "2px",
                          cursor: "pointer",
                          fontSize: "var(--text-xs)",
                          color: "var(--text-soft)",
                        }}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        style={{
                          minWidth: 36,
                          minHeight: 36,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "none",
                          border: "1px solid var(--border)",
                          borderRadius: "2px",
                          cursor: "pointer",
                          fontSize: "var(--text-xs)",
                          color: "var(--clay)",
                        }}
                        title="Remove"
                      >
                        x
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}

            {/* Add item */}
            {isCaptain && addingForDate === day ? (
              <form
                action={handleAdd}
                style={{
                  padding: "var(--space-3)",
                  border: "1px dashed var(--border)",
                  marginTop: "var(--space-2)",
                }}
              >
                <input type="hidden" name="tripId" value={tripId} />
                <input type="hidden" name="date" value={day} />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px",
                    gap: "var(--space-2)",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  <div>
                    <label style={labelStyle}>Title</label>
                    <input
                      name="title"
                      required
                      placeholder="e.g. Ski lesson"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Time</label>
                    <input
                      name="time"
                      placeholder="09:00"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Optional notes"
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
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
                    <label style={labelStyle}>Location</label>
                    <input
                      name="placeName"
                      placeholder="Place name"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Link</label>
                    <input
                      name="url"
                      placeholder="https://..."
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    type="submit"
                    style={{
                      minHeight: "36px",
                      padding: "0 14px",
                      fontSize: "var(--text-xs)",
                      fontFamily: "var(--font-hanken)",
                      fontWeight: 500,
                      backgroundColor: "var(--sea)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingForDate(null)}
                    style={{
                      minHeight: "36px",
                      padding: "0 14px",
                      fontSize: "var(--text-xs)",
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
              isCaptain && (
                <button
                  type="button"
                  onClick={() => setAddingForDate(day)}
                  style={{
                    marginTop: "var(--space-2)",
                    minHeight: "36px",
                    padding: "0 14px",
                    fontSize: "var(--text-xs)",
                    fontFamily: "var(--font-dm-mono)",
                    letterSpacing: "0.04em",
                    backgroundColor: "transparent",
                    color: "var(--text-soft)",
                    border: "1px dashed var(--border)",
                    borderRadius: "2px",
                    cursor: "pointer",
                  }}
                >
                  + Add item
                </button>
              )
            )}
          </div>
        );
      })}

      {items.length === 0 && !isCaptain && (
        <p
          style={{
            textAlign: "center",
            padding: "var(--space-12) 0",
            color: "var(--text-soft)",
            fontStyle: "italic",
          }}
        >
          The captain hasn&apos;t added anything to the program yet.
        </p>
      )}
    </div>
  );
}
