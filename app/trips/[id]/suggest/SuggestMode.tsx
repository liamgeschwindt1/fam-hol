"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChangeType, Season } from "@prisma/client";
import { createProposal } from "./actions";

// ─── Types ───────────────────────────────────────────────────────

interface ProgramItemData {
  id: string;
  date: string;
  time: string | null;
  title: string;
  notes: string | null;
  placeName: string | null;
  url: string | null;
  sort: number;
}

interface StayOptionData {
  id: string;
  title: string;
  url: string;
  priceNote: string | null;
  rooms: number | null;
  capacity: number | null;
  pros: string | null;
  cons: string | null;
}

interface TripData {
  id: string;
  title: string;
  tagline: string | null;
  descriptionMd: string;
  startDate: string;
  endDate: string;
  season: Season;
  revision: number;
  programItems: ProgramItemData[];
  stayOptions: StayOptionData[];
}

interface ChangeEntry {
  key: string;
  type: ChangeType;
  targetId?: string;
  label: string;
  beforeJson?: unknown;
  afterJson: unknown;
}

export function SuggestMode({ trip }: { trip: TripData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Editable fields
  const [title, setTitle] = useState(trip.title);
  const [tagline, setTagline] = useState(trip.tagline ?? "");
  const [description, setDescription] = useState(trip.descriptionMd);
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [season, setSeason] = useState<Season>(trip.season);

  // Program items
  const [programItems, setProgramItems] = useState<ProgramItemData[]>(
    trip.programItems,
  );
  const [removedPrograms, setRemovedPrograms] = useState<ProgramItemData[]>([]);

  // Stay options
  const [stayOptions, setStayOptions] = useState<StayOptionData[]>(
    trip.stayOptions,
  );

  // Review modal
  const [showReview, setShowReview] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalDesc, setProposalDesc] = useState("");

  // ─── Build changes ───────────────────────────────────

  const buildChanges = useCallback((): ChangeEntry[] => {
    const changes: ChangeEntry[] = [];

    if (title !== trip.title) {
      changes.push({
        key: "title",
        type: "TRIP_FIELD_SET",
        label: "Change title",
        beforeJson: { field: "title", value: trip.title },
        afterJson: { field: "title", value: title },
      });
    }

    if (tagline !== (trip.tagline ?? "")) {
      changes.push({
        key: "tagline",
        type: "TRIP_FIELD_SET",
        label: "Change tagline",
        beforeJson: { field: "tagline", value: trip.tagline },
        afterJson: { field: "tagline", value: tagline || null },
      });
    }

    if (description !== trip.descriptionMd) {
      changes.push({
        key: "description",
        type: "TRIP_FIELD_SET",
        label: "Change description",
        beforeJson: { field: "descriptionMd", value: trip.descriptionMd },
        afterJson: { field: "descriptionMd", value: description },
      });
    }

    if (startDate !== trip.startDate || endDate !== trip.endDate) {
      changes.push({
        key: "dates",
        type: "DATES_SET",
        label: "Change dates",
        beforeJson: { startDate: trip.startDate, endDate: trip.endDate },
        afterJson: { startDate, endDate },
      });
    }

    if (season !== trip.season) {
      changes.push({
        key: "season",
        type: "TRIP_FIELD_SET",
        label: "Change season",
        beforeJson: { field: "season", value: trip.season },
        afterJson: { field: "season", value: season },
      });
    }

    // Removed program items
    for (const item of removedPrograms) {
      changes.push({
        key: `prog-remove-${item.id}`,
        type: "PROGRAM_ITEM_REMOVE",
        targetId: item.id,
        label: `Remove "${item.title}"`,
        beforeJson: item,
        afterJson: { removed: true },
      });
    }

    // Modified program items
    for (const item of programItems) {
      const original = trip.programItems.find((p) => p.id === item.id);
      if (original) {
        if (
          item.title !== original.title ||
          item.date !== original.date ||
          item.time !== original.time ||
          item.notes !== original.notes ||
          item.placeName !== original.placeName
        ) {
          changes.push({
            key: `prog-update-${item.id}`,
            type: "PROGRAM_ITEM_UPDATE",
            targetId: item.id,
            label: `Update "${item.title}"`,
            beforeJson: original,
            afterJson: item,
          });
        }
      } else {
        // New item
        changes.push({
          key: `prog-add-${item.id}`,
          type: "PROGRAM_ITEM_ADD",
          label: `Add "${item.title}"`,
          afterJson: item,
        });
      }
    }

    // New stay options
    for (const stay of stayOptions) {
      const original = trip.stayOptions.find((s) => s.id === stay.id);
      if (!original) {
        changes.push({
          key: `stay-add-${stay.id}`,
          type: "STAY_OPTION_ADD",
          label: `Add stay "${stay.title}"`,
          afterJson: stay,
        });
      }
    }

    return changes;
  }, [
    title,
    tagline,
    description,
    startDate,
    endDate,
    season,
    programItems,
    removedPrograms,
    stayOptions,
    trip,
  ]);

  const changes = buildChanges();

  // ─── Program item helpers ──────────────────────────

  const addProgramItem = () => {
    const newItem: ProgramItemData = {
      id: `new-${Date.now()}`,
      date: startDate,
      time: null,
      title: "",
      notes: null,
      placeName: null,
      url: null,
      sort: programItems.length,
    };
    setProgramItems([...programItems, newItem]);
  };

  const updateProgramItem = (id: string, updates: Partial<ProgramItemData>) => {
    setProgramItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const removeProgramItem = (id: string) => {
    const item = programItems.find((p) => p.id === id);
    if (item && trip.programItems.some((p) => p.id === id)) {
      setRemovedPrograms([...removedPrograms, item]);
    }
    setProgramItems((items) => items.filter((p) => p.id !== id));
  };

  // ─── Stay option helpers ───────────────────────────

  const addStayOption = () => {
    const newStay: StayOptionData = {
      id: `new-${Date.now()}`,
      title: "",
      url: "",
      priceNote: null,
      rooms: null,
      capacity: null,
      pros: null,
      cons: null,
    };
    setStayOptions([...stayOptions, newStay]);
  };

  const updateStayOption = (id: string, updates: Partial<StayOptionData>) => {
    setStayOptions((opts) =>
      opts.map((opt) => (opt.id === id ? { ...opt, ...updates } : opt)),
    );
  };

  // ─── Submit ────────────────────────────────────────

  const handleSubmit = () => {
    if (!proposalTitle.trim()) return;

    startTransition(async () => {
      const result = await createProposal(
        trip.id,
        proposalTitle,
        proposalDesc || null,
        changes.map((c) => ({
          type: c.type,
          targetId: c.targetId,
          beforeJson: c.beforeJson,
          afterJson: c.afterJson,
        })),
      );
      router.push(`/trips/${trip.id}/proposals/${result.proposalId}`);
    });
  };

  const SEASONS: Season[] = [
    "SNOW",
    "SURF",
    "EASTER",
    "CHRISTMAS",
    "NYE",
    "SUMMER",
    "CITY",
    "OTHER",
  ];

  return (
    <div style={{ paddingBottom: "100px" }}>
      {/* Title */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <label className="label-caps" style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </section>

      {/* Tagline */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <label className="label-caps" style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Tagline
        </label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          style={inputStyle}
        />
      </section>

      {/* Description */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <label className="label-caps" style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          style={{ ...inputStyle, resize: "vertical" as const }}
        />
      </section>

      {/* Dates */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <label className="label-caps" style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Dates
        </label>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ ...inputStyle, flex: "1", minWidth: "160px" }}
          />
          <span style={{ alignSelf: "center", color: "var(--text-soft)" }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ ...inputStyle, flex: "1", minWidth: "160px" }}
          />
        </div>
      </section>

      {/* Season */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <label className="label-caps" style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Season
        </label>
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value as Season)}
          style={inputStyle}
        >
          {SEASONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
            </option>
          ))}
        </select>
      </section>

      <hr />

      {/* Program Items */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <span className="label-caps">Program Items</span>
          <button onClick={addProgramItem} style={smallBtnStyle}>
            + Add item
          </button>
        </div>

        {programItems.length === 0 && (
          <p style={{ color: "var(--text-soft)", fontStyle: "italic" }}>
            No program items yet.
          </p>
        )}

        {programItems.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid var(--border)",
              padding: "var(--space-4)",
              marginBottom: "var(--space-3)",
            }}
          >
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateProgramItem(item.id, { title: e.target.value })}
                placeholder="Activity title"
                style={{ ...inputStyle, flex: "2", minWidth: "160px" }}
              />
              <input
                type="date"
                value={item.date}
                onChange={(e) => updateProgramItem(item.id, { date: e.target.value })}
                style={{ ...inputStyle, flex: "1", minWidth: "140px" }}
              />
              <input
                type="text"
                value={item.time ?? ""}
                onChange={(e) => updateProgramItem(item.id, { time: e.target.value || null })}
                placeholder="Time"
                style={{ ...inputStyle, width: "100px" }}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <input
                type="text"
                value={item.placeName ?? ""}
                onChange={(e) => updateProgramItem(item.id, { placeName: e.target.value || null })}
                placeholder="Place"
                style={{ ...inputStyle, flex: "1", minWidth: "140px" }}
              />
              <input
                type="text"
                value={item.notes ?? ""}
                onChange={(e) => updateProgramItem(item.id, { notes: e.target.value || null })}
                placeholder="Notes"
                style={{ ...inputStyle, flex: "2", minWidth: "160px" }}
              />
              <button
                onClick={() => removeProgramItem(item.id)}
                style={{ ...smallBtnStyle, color: "var(--clay)" }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </section>

      <hr />

      {/* Stay Options */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <span className="label-caps">Stay Options</span>
          <button onClick={addStayOption} style={smallBtnStyle}>
            + Add stay
          </button>
        </div>

        {stayOptions.map((stay) => {
          const isNew = !trip.stayOptions.some((s) => s.id === stay.id);
          return (
            <div
              key={stay.id}
              style={{
                border: isNew
                  ? "1px solid var(--moss)"
                  : "1px solid var(--border)",
                padding: "var(--space-4)",
                marginBottom: "var(--space-3)",
              }}
            >
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
                <input
                  type="text"
                  value={stay.title}
                  onChange={(e) => updateStayOption(stay.id, { title: e.target.value })}
                  placeholder="Stay name"
                  style={{ ...inputStyle, flex: "2", minWidth: "160px" }}
                  readOnly={!isNew}
                />
                <input
                  type="url"
                  value={stay.url}
                  onChange={(e) => updateStayOption(stay.id, { url: e.target.value })}
                  placeholder="URL"
                  style={{ ...inputStyle, flex: "2", minWidth: "160px" }}
                  readOnly={!isNew}
                />
              </div>
              {isNew && (
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={stay.priceNote ?? ""}
                    onChange={(e) => updateStayOption(stay.id, { priceNote: e.target.value || null })}
                    placeholder="Price note"
                    style={{ ...inputStyle, flex: "1", minWidth: "120px" }}
                  />
                  <input
                    type="text"
                    value={stay.pros ?? ""}
                    onChange={(e) => updateStayOption(stay.id, { pros: e.target.value || null })}
                    placeholder="Pros"
                    style={{ ...inputStyle, flex: "1", minWidth: "120px" }}
                  />
                  <input
                    type="text"
                    value={stay.cons ?? ""}
                    onChange={(e) => updateStayOption(stay.id, { cons: e.target.value || null })}
                    placeholder="Cons"
                    style={{ ...inputStyle, flex: "1", minWidth: "120px" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ─── Sticky footer ───────────────────────────── */}
      {changes.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "var(--paper)",
            borderTop: "1px solid var(--border)",
            padding: "var(--space-4) var(--space-6)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 50,
          }}
        >
          <span
            className="font-mono-ft"
            style={{ fontSize: "var(--text-sm)", color: "var(--text-soft)" }}
          >
            {changes.length} change{changes.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setShowReview(true)}
            style={primaryBtnStyle}
          >
            Review and submit
          </button>
        </div>
      )}

      {/* ─── Review modal ────────────────────────────── */}
      {showReview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "var(--space-4)",
          }}
          onClick={() => setShowReview(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--paper)",
              border: "1px solid var(--border)",
              padding: "var(--space-8)",
              maxWidth: "640px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <h2
              className="font-display"
              style={{
                fontSize: "var(--text-2xl)",
                margin: "0 0 var(--space-6) 0",
              }}
            >
              Submit proposal
            </h2>

            <label className="label-caps" style={{ display: "block", marginBottom: "var(--space-2)" }}>
              Proposal title
            </label>
            <input
              type="text"
              value={proposalTitle}
              onChange={(e) => setProposalTitle(e.target.value)}
              placeholder="e.g. Add water park day"
              style={{ ...inputStyle, marginBottom: "var(--space-4)" }}
            />

            <label className="label-caps" style={{ display: "block", marginBottom: "var(--space-2)" }}>
              Description (optional)
            </label>
            <textarea
              value={proposalDesc}
              onChange={(e) => setProposalDesc(e.target.value)}
              placeholder="Why these changes?"
              rows={3}
              style={{ ...inputStyle, marginBottom: "var(--space-6)", resize: "vertical" as const }}
            />

            <div className="label-caps" style={{ marginBottom: "var(--space-3)" }}>
              {changes.length} change{changes.length !== 1 ? "s" : ""}
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 var(--space-6) 0" }}>
              {changes.map((c) => (
                <li
                  key={c.key}
                  style={{
                    padding: "var(--space-2) 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <span
                    className="font-mono-ft"
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-soft)",
                      marginRight: "var(--space-2)",
                    }}
                  >
                    {c.type.replace(/_/g, " ").toLowerCase()}
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>

            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowReview(false)}
                style={smallBtnStyle}
              >
                Back to editing
              </button>
              <button
                onClick={handleSubmit}
                disabled={!proposalTitle.trim() || isPending}
                style={{
                  ...primaryBtnStyle,
                  opacity: !proposalTitle.trim() || isPending ? 0.5 : 1,
                }}
              >
                {isPending ? "Submitting..." : "Submit proposal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "var(--space-3)",
  fontFamily: "var(--font-hanken), system-ui, sans-serif",
  fontSize: "var(--text-sm)",
  color: "var(--ink)",
  backgroundColor: "var(--paper)",
  border: "1px solid var(--border)",
  minHeight: "44px",
  outline: "none",
};

const smallBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-dm-mono), monospace",
  fontSize: "var(--text-xs)",
  letterSpacing: "0.04em",
  color: "var(--sea)",
  backgroundColor: "transparent",
  border: "1px solid var(--border)",
  padding: "var(--space-2) var(--space-4)",
  cursor: "pointer",
  minHeight: "44px",
};

const primaryBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-dm-mono), monospace",
  fontSize: "var(--text-sm)",
  letterSpacing: "0.04em",
  color: "#fff",
  backgroundColor: "var(--sea)",
  border: "none",
  padding: "var(--space-3) var(--space-6)",
  cursor: "pointer",
  minHeight: "44px",
};
