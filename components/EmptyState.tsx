type EmptyIcon = "trips" | "costs" | "comments" | "proposals" | "inbox";

interface EmptyStateProps {
  icon: EmptyIcon;
  title: string;
  description: string;
}

function SuitcaseIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="16" width="32" height="22" rx="3" />
      <path d="M17 16V12a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4" />
      <line x1="8" y1="26" x2="40" y2="26" stroke="var(--sea)" />
      <line x1="20" y1="22" x2="20" y2="30" stroke="var(--sea)" />
      <line x1="28" y1="22" x2="28" y2="30" stroke="var(--sea)" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 6h20a2 2 0 0 1 2 2v32l-4-3-4 3-4-3-4 3-4-3-4 3V8a2 2 0 0 1 2-2z" />
      <line x1="18" y1="16" x2="30" y2="16" stroke="var(--sea)" />
      <line x1="18" y1="22" x2="30" y2="22" stroke="var(--sea)" />
      <line x1="18" y1="28" x2="26" y2="28" />
    </svg>
  );
}

function SpeechBubbleIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 10h32a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H18l-8 6V32H8a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z" />
      <line x1="16" y1="19" x2="32" y2="19" stroke="var(--sea)" />
      <line x1="16" y1="25" x2="28" y2="25" stroke="var(--sea)" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 34v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" />
      <path
        d="M24 8a10 10 0 0 1 6 18c-1 1.2-2 2.5-2 4v4h-8v-4c0-1.5-1-2.8-2-4A10 10 0 0 1 24 8z"
        stroke="var(--sea)"
      />
      <line x1="20" y1="38" x2="28" y2="38" />
      <line x1="24" y1="4" x2="24" y2="6" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="16" />
      <polyline points="16,24 22,30 32,18" stroke="var(--sea)" />
    </svg>
  );
}

const ICONS: Record<EmptyIcon, () => React.JSX.Element> = {
  trips: SuitcaseIcon,
  costs: ReceiptIcon,
  comments: SpeechBubbleIcon,
  proposals: LightbulbIcon,
  inbox: CheckCircleIcon,
};

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  const Icon = ICONS[icon];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "var(--space-16) var(--space-6)",
      }}
    >
      <div style={{ color: "var(--text-soft)", marginBottom: "var(--space-4)" }}>
        <Icon />
      </div>
      <p
        style={{
          fontFamily: "var(--font-instrument)",
          fontSize: "var(--text-2xl)",
          fontStyle: "italic",
          color: "var(--text)",
          margin: "0 0 var(--space-2) 0",
        }}
      >
        {title}
      </p>
      <p
        style={{
          color: "var(--text-soft)",
          margin: 0,
          maxWidth: "28rem",
        }}
      >
        {description}
      </p>
    </div>
  );
}
