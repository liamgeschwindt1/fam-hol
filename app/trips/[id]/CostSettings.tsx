"use client";

import {
  addRoom,
  removeRoom,
  setAgeWeights,
  setBankDetails,
} from "./cost-actions";
import { MoneyError, useMoneyAction } from "./MoneyForms";
import type { AgeBand } from "@/lib/costs/engine";

interface CostSettingsProps {
  tripId: string;
  members: { id: string; name: string }[];
  rooms: { id: string; label: string; memberIds: string[] }[];
  ageWeights: Record<AgeBand, number>;
  bankDetails: string | null;
}

const AGE_LABELS: Record<AgeBand, string> = {
  ADULT: "Adults",
  CHILD_12_17: "Ages 12–17",
  CHILD_5_11: "Ages 5–11",
  CHILD_0_4: "Ages 0–4",
};

export function CostSettings({
  tripId,
  members,
  rooms,
  ageWeights,
  bankDetails,
}: CostSettingsProps) {
  const [roomError, roomAction, roomPending] = useMoneyAction(async (data) => {
    await addRoom(
      tripId,
      String(data.get("label")),
      data.getAll("memberId").map(String),
    );
  });
  const [removeError, removeAction, removePending] = useMoneyAction(
    async (data) => {
      await removeRoom(String(data.get("roomId")));
    },
  );
  const [weightError, weightAction, weightPending] = useMoneyAction(
    async (data) => {
      const weights = Object.fromEntries(
        Object.keys(AGE_LABELS).map((key) => [key, Number(data.get(key))]),
      );
      await setAgeWeights(tripId, weights);
    },
  );
  const [bankError, bankAction, bankPending] = useMoneyAction(async (data) => {
    await setBankDetails(tripId, String(data.get("bankDetails")));
  });
  const assigned = new Set(rooms.flatMap((room) => room.memberIds));

  return (
    <section
      style={{
        marginTop: "var(--space-6)",
        display: "grid",
        gap: "var(--space-6)",
      }}
    >
      <details>
        <summary>Rooms and occupants</summary>
        <MoneyError error={removeError} />
        {rooms.map((room) => (
          <form
            key={room.id}
            action={removeAction}
            style={{
              padding: "var(--space-3) 0",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            <input type="hidden" name="roomId" value={room.id} />
            <p>
              {room.label}:{" "}
              {room.memberIds
                .map((id) => members.find((m) => m.id === id)?.name ?? id)
                .join(", ")}
            </p>
            <button disabled={removePending}>Remove room</button>
          </form>
        ))}
        <form
          action={roomAction}
          style={{
            display: "grid",
            gap: "var(--space-3)",
            marginTop: "var(--space-3)",
          }}
        >
          <MoneyError error={roomError} />
          <label>
            Room name <input name="label" required maxLength={200} />
          </label>
          <fieldset>
            <legend>Occupants (one room per person)</legend>
            {members
              .filter((m) => !assigned.has(m.id))
              .map((m) => (
                <label
                  key={m.id}
                  style={{ display: "block", minHeight: "44px" }}
                >
                  <input type="checkbox" name="memberId" value={m.id} />{" "}
                  {m.name}
                </label>
              ))}
          </fieldset>
          <button disabled={roomPending}>Add room</button>
        </form>
      </details>
      <details>
        <summary>Child discounts</summary>
        <form
          action={weightAction}
          style={{
            display: "grid",
            gap: "var(--space-3)",
            marginTop: "var(--space-3)",
          }}
        >
          <MoneyError error={weightError} />
          <p>
            1 is a full share; 0.5 is half; 0 is free. Applies only to lines
            with child discounts enabled.
          </p>
          {(Object.keys(AGE_LABELS) as AgeBand[]).map((key) => (
            <label key={key}>
              {AGE_LABELS[key]}{" "}
              <input
                name={key}
                type="number"
                min="0"
                max="10"
                step="0.01"
                required
                defaultValue={ageWeights[key]}
              />
            </label>
          ))}
          <button disabled={weightPending}>Save weights</button>
        </form>
      </details>
      <details>
        <summary>Payment instructions</summary>
        <form
          action={bankAction}
          style={{
            display: "grid",
            gap: "var(--space-3)",
            marginTop: "var(--space-3)",
          }}
        >
          <MoneyError error={bankError} />
          <label>
            Bank details or payment instructions
            <textarea
              name="bankDetails"
              rows={4}
              maxLength={2000}
              defaultValue={bankDetails ?? ""}
            />
          </label>
          <p>Only attendees on confirmed trips can see these instructions.</p>
          <button disabled={bankPending}>Save instructions</button>
        </form>
      </details>
    </section>
  );
}
