"use client";

import { useState } from "react";
import Link from "next/link";
import { switchGroup } from "@/app/groups/actions";

interface GroupOption {
  id: string;
  familyId: string;
  family: { name: string };
}

export function GroupSwitcher({
  groups,
  activeMemberId,
}: {
  groups: GroupOption[];
  activeMemberId: string | null;
}) {
  const [selectedId, setSelectedId] = useState(activeMemberId ?? groups[0]?.id ?? "");

  if (!groups.length) return null;

  return (
    <div className="group-switcher">
      {groups.length > 1 && (
        <form action={switchGroup} className="group-switcher-form">
          <label className="sr-only" htmlFor="active-group">
            Switch group
          </label>
          <select
            id="active-group"
            name="memberId"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            aria-label="Choose a group"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.family.name}
              </option>
            ))}
          </select>
          <button type="submit">Switch</button>
        </form>
      )}
      <Link href="/groups/new" className="group-create-link">
        + New group
      </Link>
    </div>
  );
}
