"use client";

import { useState, useTransition } from "react";
import {
  changePin,
  linkEmailAccount,
  regenerateCalendarToken,
  setCalendarCostVisibility,
} from "./actions";
import { MoneyError, useMoneyAction } from "../trips/[id]/MoneyForms";

export function ProfileActions({
  calendarToken,
  calendarShowCosts,
  accountEmail,
}: {
  calendarToken: string;
  calendarShowCosts: boolean;
  accountEmail: string | null;
}) {
  const [error, action, pending] = useMoneyAction(async (data) => {
    await setCalendarCostVisibility(data.get("showCosts") === "on");
  });
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-8)",
      }}
    >
      <ChangePinForm />
      <EmailAccountSection accountEmail={accountEmail} />
      <CalendarTokenSection calendarToken={calendarToken} />
      <form action={action}>
        <MoneyError error={error} />
        <label>
          <input
            name="showCosts"
            type="checkbox"
            defaultChecked={calendarShowCosts}
          />{" "}
          Include my cost share in calendar feeds and downloads
        </label>
        <button
          disabled={pending}
          style={{
            display: "block",
            minHeight: "44px",
            marginTop: "var(--space-3)",
          }}
        >
          Save calendar privacy
        </button>
      </form>
    </div>
  );
}

function EmailAccountSection({ accountEmail }: { accountEmail: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await linkEmailAccount(
          String(formData.get("email") ?? ""),
          String(formData.get("pin") ?? ""),
        );
        setMessage({ text: "Email account linked.", isError: false });
      } catch (error) {
        setMessage({
          text: error instanceof Error ? error.message : "Could not link email account.",
          isError: true,
        });
      }
    });
  }

  return (
    <section>
      <h3 style={{ fontSize: "var(--text-sm)", margin: "0 0 var(--space-3)", color: "var(--ink)" }}>
        Email account
      </h3>
      {accountEmail ? (
        <p style={{ color: "var(--text-soft)" }}>
          This profile is linked to <strong>{accountEmail}</strong>. You can use it to switch between groups.
        </p>
      ) : (
        <form action={handleSubmit} className="account-link-form">
          <p>Link an email account to use this profile in other groups.</p>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Account PIN (4–8 digits)
            <input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} required />
          </label>
          <button type="submit" disabled={isPending}>
            {isPending ? "Linking…" : "Link account"}
          </button>
        </form>
      )}
      {message && <p role={message.isError ? "alert" : "status"}>{message.text}</p>}
    </section>
  );
}

function ChangePinForm() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      try {
        await changePin(oldPin, newPin);
        setMessage({ text: "PIN updated.", isError: false });
        setOldPin("");
        setNewPin("");
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : "Failed to update PIN.",
          isError: true,
        });
      }
    });
  }

  return (
    <section>
      <h3
        style={{
          fontFamily: "var(--font-hanken)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          margin: "0 0 var(--space-3) 0",
          color: "var(--ink)",
        }}
      >
        Change PIN
      </h3>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <div>
          <label
            htmlFor="old-pin"
            style={{
              display: "block",
              fontSize: "var(--text-xs)",
              color: "var(--ink-soft)",
              marginBottom: "var(--space-1)",
            }}
          >
            Current PIN
          </label>
          <input
            id="old-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            minLength={4}
            maxLength={8}
            autoComplete="current-password"
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value)}
            required
            style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "var(--text-sm)",
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--rule)",
              backgroundColor: "var(--paper)",
              color: "var(--ink)",
              width: "100%",
              maxWidth: "200px",
            }}
          />
        </div>
        <div>
          <label
            htmlFor="new-pin"
            style={{
              display: "block",
              fontSize: "var(--text-xs)",
              color: "var(--ink-soft)",
              marginBottom: "var(--space-1)",
            }}
          >
            New PIN
          </label>
          <input
            id="new-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            autoComplete="new-password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            required
            minLength={4}
            maxLength={8}
            style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "var(--text-sm)",
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--rule)",
              backgroundColor: "var(--paper)",
              color: "var(--ink)",
              width: "100%",
              maxWidth: "200px",
            }}
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={isPending}
            style={{
              fontFamily: "var(--font-hanken)",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              padding: "var(--space-2) var(--space-4)",
              backgroundColor: "var(--sea)",
              color: "#fff",
              border: "none",
              cursor: isPending ? "wait" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Updating..." : "Update PIN"}
          </button>
        </div>
        {message && (
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: message.isError ? "var(--clay)" : "var(--moss)",
              margin: 0,
            }}
          >
            {message.text}
          </p>
        )}
      </form>
    </section>
  );
}

function CalendarTokenSection({ calendarToken }: { calendarToken: string }) {
  const [isPending, startTransition] = useTransition();
  const [token] = useState(calendarToken);
  const [copied, setCopied] = useState(false);

  const calendarUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/cal/${token}`
      : `/cal/${token}`;

  function handleRegenerate() {
    startTransition(async () => {
      try {
        await regenerateCalendarToken();
        // Token will be updated on revalidation; for now show pending state
      } catch {
        // Silently fail - page will revalidate
      }
    });
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(calendarUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <section>
      <h3
        style={{
          fontFamily: "var(--font-hanken)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          margin: "0 0 var(--space-3) 0",
          color: "var(--ink)",
        }}
      >
        Calendar subscription
      </h3>
      <p
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--ink-soft)",
          margin: "0 0 var(--space-2) 0",
        }}
      >
        Add this link to your calendar app to see trip dates.
      </p>
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--ink-soft)",
            backgroundColor: "var(--paper-2)",
            padding: "var(--space-1) var(--space-2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "300px",
            display: "inline-block",
          }}
        >
          {calendarUrl}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            fontFamily: "var(--font-hanken)",
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            padding: "var(--space-1) var(--space-3)",
            backgroundColor: "transparent",
            color: "var(--sea)",
            border: "1px solid var(--sea)",
            cursor: "pointer",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isPending}
          style={{
            fontFamily: "var(--font-hanken)",
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            padding: "var(--space-1) var(--space-3)",
            backgroundColor: "transparent",
            color: "var(--clay)",
            border: "1px solid var(--clay)",
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Regenerating..." : "Regenerate"}
        </button>
      </div>
    </section>
  );
}
