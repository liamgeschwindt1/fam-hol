"use client";

import { useActionState, useRef, useState } from "react";
import { joinFamily, type JoinState } from "./actions";
import { PhotoCropper } from "@/components/PhotoCropper";

interface Household {
  id: string;
  name: string;
}

interface JoinFormProps {
  token: string;
  invitedEmail: string | null;
  accountEmail: string | null;
  households: Household[];
}

const initialState: JoinState = {};

export default function JoinForm({ token, invitedEmail, accountEmail, households }: JoinFormProps) {
  const [state, action, pending] = useActionState(joinFamily, initialState);
  const [photoKey, setPhotoKey] = useState("");
  const [householdValue, setHouseholdValue] = useState(
    households[0]?.id ?? "new",
  );
  const photoKeyRef = useRef<HTMLInputElement>(null);

  function handlePhotoUploaded(key: string) {
    setPhotoKey(key);
    if (photoKeyRef.current) photoKeyRef.current.value = key;
  }

  const showNewHousehold =
    householdValue === "new" || households.length === 0;

  return (
    <form
      action={action}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <input type="hidden" name="token" value={token} />
      <input ref={photoKeyRef} type="hidden" name="photoKey" value={photoKey} />

      {state.message && (
        <p style={{ color: "var(--danger)", fontSize: "var(--text-sm)" }}>
          {state.message}
        </p>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" style={labelStyle}>
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. James"
          style={inputStyle}
          autoComplete="given-name"
        />
        {state.errors?.name && (
          <p style={errorStyle}>{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" style={labelStyle}>Email account</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          readOnly={!!invitedEmail || !!accountEmail}
          defaultValue={invitedEmail ?? accountEmail ?? ""}
          placeholder="you@example.com"
          autoComplete="email"
          style={inputStyle}
        />
        {state.errors?.email && <p style={errorStyle}>{state.errors.email[0]}</p>}
      </div>

      {/* Photo */}
      <div>
        <span style={labelStyle}>Photo</span>
        <PhotoCropper onUploaded={handlePhotoUploaded} />
        {state.errors?.photoKey && (
          <p style={errorStyle}>{state.errors.photoKey[0]}</p>
        )}
      </div>

      {/* Household */}
      <div>
        <label htmlFor="householdId" style={labelStyle}>
          Household
        </label>
        <select
          id="householdId"
          name="householdId"
          value={householdValue}
          onChange={(e) => setHouseholdValue(e.target.value)}
          style={selectStyle}
        >
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
          <option value="new">Create new household…</option>
        </select>

        {showNewHousehold && (
          <input
            name="newHouseholdName"
            type="text"
            placeholder="Household name"
            style={{ ...inputStyle, marginTop: "var(--space-2)" }}
            autoComplete="off"
          />
        )}
      </div>

      {!accountEmail && <div>
        <label htmlFor="pin" style={labelStyle}>Account PIN (4–8 digits)</label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4,8}"
          minLength={4}
          maxLength={8}
          required
          placeholder="4–8 digits"
          style={{ ...inputStyle, fontFamily: "var(--font-dm-mono)", letterSpacing: "0.3em" }}
          autoComplete="new-password"
        />
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-soft)", marginTop: "var(--space-1)" }}>
          If this email already has an account, enter its PIN to join this group.
        </p>
        {state.errors?.pin && <p style={errorStyle}>{state.errors.pin[0]}</p>}
      </div>}

      <button type="submit" disabled={pending} style={buttonStyle(pending)}>
        {pending ? "Joining…" : "Join the family"}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--text-soft)",
  marginBottom: "var(--space-2)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "44px",
  padding: "0 var(--space-3)",
  fontSize: "var(--text-sm)",
  color: "var(--ink)",
  backgroundColor: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--danger)",
  marginTop: "var(--space-1)",
};

function buttonStyle(pending: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "44px",
    padding: "0 var(--space-6)",
    backgroundColor: pending ? "var(--ink-soft)" : "var(--sea)",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    cursor: pending ? "not-allowed" : "pointer",
    transition: "background-color var(--duration-fast) var(--ease-out)",
  };
}
