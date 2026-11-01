import { requireMember } from "@/lib/auth";
import { CreateTripForm } from "./CreateTripForm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New trip",
};

export default async function NewTripPage() {
  await requireMember();

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-6)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-instrument)",
          fontSize: "var(--text-3xl)",
          fontWeight: 400,
          margin: "0 0 var(--space-8) 0",
          color: "var(--ink)",
        }}
      >
        Plan a new trip
      </h1>

      <CreateTripForm />
    </div>
  );
}
