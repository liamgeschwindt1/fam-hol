"use client";

import { useActionState } from "react";

export function useMoneyAction(action: (data: FormData) => Promise<unknown>) {
  return useActionState(async (_previous: string | null, data: FormData) => {
    try {
      await action(data);
      return null;
    } catch (error) {
      console.error("Money action failed", error);
      return error instanceof Error
        ? error.message
        : "The change could not be saved. Please try again.";
    }
  }, null);
}

export function MoneyError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" style={{ color: "var(--clay)", gridColumn: "1 / -1" }}>
      {error}
    </p>
  ) : null;
}
