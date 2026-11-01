"use client";

import { useActionState, useRef, useState } from "react";
import { setupFamily, type SetupState } from "./actions";
import { PhotoCropper } from "@/components/PhotoCropper";
import { MemberAvatar } from "@/components/MemberAvatar";

const CURRENCIES = [
  { code: "GBP", label: "GBP — British Pound" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "DKK", label: "DKK — Danish Krone" },
];

const initialState: SetupState = {};

export default function SetupForm() {
  const [state, action, pending] = useActionState(setupFamily, initialState);
  const [photoKey, setPhotoKey] = useState<string>("");
  const [name, setName] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoKeyRef = useRef<HTMLInputElement>(null);

  function handlePhotoUploaded(key: string) {
    setPhotoKey(key);
    if (photoKeyRef.current) photoKeyRef.current.value = key;
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {state.message && (
        <p style={{ color: "var(--danger)", fontSize: "var(--text-sm)" }}>
          {state.message}
        </p>
      )}

      {/* Family name */}
      <div>
        <label htmlFor="familyName" style={labelStyle}>
          Family name
        </label>
        <input
          id="familyName"
          name="familyName"
          type="text"
          required
          placeholder="e.g. The Johnsons"
          style={inputStyle}
          autoComplete="off"
        />
        {state.errors?.familyName && (
          <p style={errorStyle}>{state.errors.familyName[0]}</p>
        )}
      </div>

      {/* Admin name */}
      <div>
        <label htmlFor="adminName" style={labelStyle}>
          Your name
        </label>
        <input
          id="adminName"
          name="adminName"
          type="text"
          required
          placeholder="e.g. Sarah"
          style={inputStyle}
          autoComplete="given-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {state.errors?.adminName && (
          <p style={errorStyle}>{state.errors.adminName[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" style={labelStyle}>Your email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          style={inputStyle}
        />
        {state.errors?.email && <p style={errorStyle}>{state.errors.email[0]}</p>}
      </div>

      <div>
        <label htmlFor="pin" style={labelStyle}>Choose a 4–8 digit PIN</label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4,8}"
          minLength={4}
          maxLength={8}
          required
          autoComplete="new-password"
          style={inputStyle}
        />
        {state.errors?.pin && <p style={errorStyle}>{state.errors.pin[0]}</p>}
      </div>

      {/* Photo */}
      <div>
        <span style={labelStyle}>Your icon</span>
        {!photoKey && <MemberAvatar name={name || "New explorer"} photoKey={null} size={64} />}
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-soft)" }}>Your emoji is automatic. A photo is optional.</p>
        <PhotoCropper onUploaded={handlePhotoUploaded} onUploadingChange={setUploadingPhoto} />
        <input
          ref={photoKeyRef}
          type="hidden"
          name="photoKey"
          value={photoKey}
        />
      </div>

      {/* Currencies */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <div>
          <label htmlFor="homeCurrency" style={labelStyle}>
            Home currency
          </label>
          <select id="homeCurrency" name="homeCurrency" defaultValue="GBP" style={selectStyle}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          {state.errors?.homeCurrency && (
            <p style={errorStyle}>{state.errors.homeCurrency[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="secondCurrency" style={labelStyle}>
            Second currency
          </label>
          <select id="secondCurrency" name="secondCurrency" defaultValue="EUR" style={selectStyle}>
            <option value="">None</option>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          {state.errors?.secondCurrency && (
            <p style={errorStyle}>{state.errors.secondCurrency[0]}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || uploadingPhoto}
        style={buttonStyle(pending || uploadingPhoto)}
      >
        {uploadingPhoto ? "Uploading photo…" : pending ? "Creating…" : "Create family space"}
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
  borderRadius: "10px",
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
    borderRadius: "10px",
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    cursor: pending ? "not-allowed" : "pointer",
    transition: "background-color var(--duration-fast) var(--ease-out)",
  };
}
