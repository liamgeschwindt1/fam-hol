"use client";

import { useState, useTransition } from "react";
import { regenerateCalendarToken } from "./actions";

interface SubscriptionPanelProps {
  calendarToken: string;
  baseUrl: string;
}

export function SubscriptionPanel({ calendarToken, baseUrl }: SubscriptionPanelProps) {
  const [token, setToken] = useState(calendarToken);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const feedUrl = `${baseUrl}/cal/${token}.ics`;
  const webcalUrl = feedUrl.replace(/^https?:/, "webcal:");

  function handleCopy() {
    navigator.clipboard.writeText(feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleRegenerate() {
    if (!confirm("Regenerate your calendar token? Your existing subscriptions will stop working.")) return;
    startTransition(async () => {
      const newToken = await regenerateCalendarToken();
      setToken(newToken);
    });
  }

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "36px",
    padding: "0 16px",
    fontSize: "var(--text-xs)",
    fontFamily: "var(--font-hanken)",
    fontWeight: 500,
    border: "1px solid var(--border)",
    borderRadius: "2px",
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "var(--text)",
    transition: "background-color var(--duration-fast) var(--ease-out)",
  };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "2px",
        padding: "var(--space-4)",
        backgroundColor: "var(--paper-2)",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-instrument)",
          fontSize: "var(--text-lg)",
          fontWeight: 400,
          margin: "0 0 var(--space-3) 0",
          color: "var(--ink)",
        }}
      >
        Subscribe to calendar
      </h3>

      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-soft)", margin: "0 0 var(--space-3) 0" }}>
        Add your trips to Apple Calendar, Outlook, or Google Calendar. The feed updates automatically.
      </p>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        {/* Apple / Outlook: webcal link */}
        <a
          href={webcalUrl}
          style={{
            ...btnStyle,
            textDecoration: "none",
            backgroundColor: "var(--sea)",
            borderColor: "var(--sea)",
            color: "#fff",
          }}
        >
          Apple / Outlook
        </a>

        {/* Copy link */}
        <button onClick={handleCopy} style={btnStyle}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <details style={{ marginBottom: "var(--space-3)" }}>
        <summary
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--accent)",
            cursor: "pointer",
            fontFamily: "var(--font-hanken)",
          }}
        >
          Google Calendar instructions
        </summary>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-soft)", marginTop: "var(--space-2)" }}>
          <ol style={{ margin: 0, paddingLeft: "var(--space-6)" }}>
            <li>Copy the calendar link above</li>
            <li>Go to Google Calendar settings</li>
            <li>Under &quot;Other calendars&quot;, click the + icon</li>
            <li>Select &quot;From URL&quot; and paste the link</li>
          </ol>
          <p style={{ marginTop: "var(--space-2)", fontStyle: "italic" }}>
            Note: Google Calendar can take several hours to refresh after changes.
          </p>
        </div>
      </details>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-3)" }}>
        <button
          onClick={handleRegenerate}
          disabled={isPending}
          style={{
            ...btnStyle,
            fontSize: "11px",
            color: "var(--clay)",
            borderColor: "var(--clay)",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Regenerating..." : "Regenerate token"}
        </button>
        <p style={{ fontSize: "11px", color: "var(--text-soft)", margin: "var(--space-1) 0 0 0" }}>
          Invalidates existing subscriptions.
        </p>
      </div>
    </div>
  );
}
