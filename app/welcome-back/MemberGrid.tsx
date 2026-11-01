"use client";

import { useActionState, useState } from "react";
import { loginWithPin, requestAdminApproval, type LoginState } from "./actions";
import { MemberAvatar } from "@/components/MemberAvatar";

interface Member {
  id: string;
  name: string;
  photoKey: string | null;
  hasPin: boolean;
}

interface MemberGridProps {
  members: Member[];
}

const initialState: LoginState = {};

export default function MemberGrid({ members }: MemberGridProps) {
  const [selected, setSelected] = useState<Member | null>(null);

  function handleSelect(member: Member) {
    setSelected(member);
  }

  function handleBack() {
    setSelected(null);
  }

  if (selected) {
    return (
      <MemberLoginPanel
        member={selected}
        onBack={handleBack}
      />
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: "var(--space-4)",
      }}
    >
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => handleSelect(m)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-4)",
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            cursor: "pointer",
            minHeight: "44px",
            transition: "border-color var(--duration-fast) var(--ease-out)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--sea)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
          }}
        >
          <MemberAvatar
            name={m.name}
            photoKey={m.photoKey}
            size={72}
          />
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--ink)",
              fontWeight: 500,
            }}
          >
            {m.name}
          </span>
        </button>
      ))}
    </div>
  );
}

function MemberLoginPanel({
  member,
  onBack,
}: {
  member: Member;
  onBack: () => void;
}) {
  const [pinState, pinAction, pinPending] = useActionState(
    loginWithPin,
    initialState,
  );
  const [approvalState, approvalAction, approvalPending] = useActionState(
    requestAdminApproval,
    initialState,
  );

  if (approvalState.needsApproval) {
    return (
      <div style={{ textAlign: "center", maxWidth: "360px", margin: "0 auto" }}>
        <MemberAvatar name={member.name} photoKey={member.photoKey} size={80} />
        <h2
          className="font-display"
          style={{
            fontSize: "var(--text-2xl)",
            color: "var(--ink)",
            margin: "var(--space-4) 0 var(--space-3)",
          }}
        >
          Request sent
        </h2>
        <p style={{ color: "var(--text-soft)", fontSize: "var(--text-sm)" }}>
          An admin has been notified. Once they approve you, you can sign in.
          Check back shortly.
        </p>
        <button
          type="button"
          onClick={onBack}
          style={backBtnStyle}
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "360px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <button type="button" onClick={onBack} style={backBtnStyle}>
          ← Back
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "var(--space-6)" }}>
        <MemberAvatar name={member.name} photoKey={member.photoKey} size={80} />
        <h2
          className="font-display"
          style={{
            fontSize: "var(--text-2xl)",
            color: "var(--ink)",
            margin: "var(--space-3) 0 0",
          }}
        >
          {member.name}
        </h2>
      </div>

      {member.hasPin ? (
        <form action={pinAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <input type="hidden" name="memberId" value={member.id} />

          {pinState.error && (
            <p style={{ color: "var(--danger)", fontSize: "var(--text-sm)" }}>
              {pinState.error}
            </p>
          )}

          <div>
            <label htmlFor="pin" style={labelStyle}>
              PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,8}"
              minLength={4}
              maxLength={8}
              required
              placeholder="••••••"
              style={{
                display: "block",
                width: "100%",
                height: "56px",
                padding: "0 var(--space-3)",
                fontSize: "var(--text-2xl)",
                fontFamily: "var(--font-dm-mono)",
                letterSpacing: "0.4em",
                textAlign: "center",
                color: "var(--ink)",
                backgroundColor: "var(--bg-raised)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                outline: "none",
              }}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={pinPending}
            style={primaryBtnStyle(pinPending)}
          >
            {pinPending ? "Checking…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form action={approvalAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <input type="hidden" name="memberId" value={member.id} />

          {approvalState.error && (
            <p style={{ color: "var(--danger)", fontSize: "var(--text-sm)" }}>
              {approvalState.error}
            </p>
          )}

          <p style={{ color: "var(--text-soft)", fontSize: "var(--text-sm)", textAlign: "center" }}>
            You don&apos;t have a PIN set. An admin will need to approve this
            device.
          </p>

          <button
            type="submit"
            disabled={approvalPending}
            style={primaryBtnStyle(approvalPending)}
          >
            {approvalPending ? "Sending…" : "Request approval"}
          </button>
        </form>
      )}
    </div>
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

const backBtnStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--sea)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

function primaryBtnStyle(pending: boolean): React.CSSProperties {
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
