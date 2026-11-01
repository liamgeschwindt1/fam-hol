import Link from "next/link";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "program", label: "Program" },
  { key: "stay", label: "Stay" },
  { key: "costs", label: "Costs" },
  { key: "proposals", label: "Proposals" },
  { key: "chat", label: "Chat" },
] as const;

interface TripTabsProps {
  tripId: string;
  activeTab: string;
}

export function TripTabs({ tripId, activeTab }: TripTabsProps) {
  return (
    <nav
      aria-label="Trip sections"
      style={{
        display: "flex",
        gap: "var(--space-1)",
        overflowX: "auto",
        borderBottom: "1px solid var(--border)",
        marginBottom: "var(--space-6)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/trips/${tripId}?tab=${tab.key}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--ink)" : "var(--text-soft)",
              textDecoration: "none",
              borderBottom: isActive
                ? "2px solid var(--sea)"
                : "2px solid transparent",
              transition: "color var(--duration-fast) var(--ease-out)",
              whiteSpace: "nowrap",
              minHeight: "44px",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
