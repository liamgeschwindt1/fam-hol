"use client";

import { useActionState, useState } from "react";
import { createTrip } from "./actions";

const SEASONS = [
  { value: "SNOW", label: "Snow" },
  { value: "SURF", label: "Surf" },
  { value: "EASTER", label: "Easter" },
  { value: "CHRISTMAS", label: "Christmas" },
  { value: "NYE", label: "NYE" },
  { value: "SUMMER", label: "Summer" },
  { value: "CITY", label: "City" },
  { value: "OTHER", label: "Other" },
] as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: "var(--text-base)",
  fontFamily: "var(--font-hanken)",
  backgroundColor: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "2px",
  outline: "none",
  minHeight: "44px",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-dm-mono)",
  fontSize: "var(--text-xs)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-soft)",
  display: "block",
  marginBottom: "var(--space-2)",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 24px",
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  fontFamily: "var(--font-hanken)",
  backgroundColor: "var(--sea)",
  color: "#fff",
  border: "none",
  borderRadius: "2px",
  cursor: "pointer",
  transition: "background-color var(--duration-fast) var(--ease-out)",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  backgroundColor: "transparent",
  color: "var(--text-soft)",
  border: "1px solid var(--border)",
};

export function CreateTripForm() {
  const [step, setStep] = useState(1);
  const [coverImageKey, setCoverImageKey] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [error, formAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      try {
        // Inject cover image key into form data
        if (coverImageKey) {
          formData.set("coverImageKey", coverImageKey);
        }
        await createTrip(formData);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "Something went wrong";
      }
    },
    null,
  );

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Get presigned URL
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { url, key } = (await res.json()) as { url: string; key: string };

      // Upload directly to S3
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setCoverImageKey(key);
      setCoverPreview(URL.createObjectURL(file));
    } catch {
      // Silently handle — user can try again
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="coverImageKey" value={coverImageKey} />

      {/* Step indicator */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          marginBottom: "var(--space-8)",
        }}
      >
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 3,
              backgroundColor:
                s <= step ? "var(--sea)" : "var(--border)",
              borderRadius: 1,
              transition:
                "background-color var(--duration-base) var(--ease-out)",
            }}
          />
        ))}
      </div>

      <div
        style={{
          fontFamily: "var(--font-dm-mono)",
          fontSize: "var(--text-xs)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-soft)",
          marginBottom: "var(--space-2)",
        }}
      >
        Step {step} of 3
      </div>

      {/* Step 1: Where & When */}
      <div style={{ display: step === 1 ? "block" : "none" }}>
        <h2
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-2xl)",
            fontWeight: 400,
            margin: "0 0 var(--space-6) 0",
            color: "var(--ink)",
          }}
        >
          Where and when?
        </h2>

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={labelStyle} htmlFor="title">
            Trip name
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="e.g. Chamonix 2027"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={labelStyle} htmlFor="destination">
            Destination
          </label>
          <input
            id="destination"
            name="destination"
            type="text"
            placeholder="e.g. Chamonix, France"
            style={inputStyle}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-4)",
            marginBottom: "var(--space-4)",
          }}
        >
          <div>
            <label style={labelStyle} htmlFor="startDate">
              Start date <span style={{ textTransform: "none" }}>(optional)</span>
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="endDate">
              End date <span style={{ textTransform: "none" }}>(optional)</span>
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              style={inputStyle}
            />
          </div>
        </div>
        <p style={{ color: "var(--text-soft)", fontSize: "var(--text-xs)", margin: "-8px 0 var(--space-4)" }}>
          Leave both dates blank if they are not decided yet.
        </p>
      </div>

      {/* Step 2: Photos & Description */}
      <div style={{ display: step === 2 ? "block" : "none" }}>
        <h2
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-2xl)",
            fontWeight: 400,
            margin: "0 0 var(--space-6) 0",
            color: "var(--ink)",
          }}
        >
          Set the scene
        </h2>

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={labelStyle}>Cover photo</label>
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              backgroundColor: "var(--paper-2)",
              border: "1px solid var(--border)",
              borderRadius: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
              cursor: "pointer",
            }}
            onClick={() =>
              document.getElementById("coverFileInput")?.click()
            }
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt="Cover preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span
                style={{
                  color: "var(--text-soft)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {uploading ? "Uploading..." : "Click to add a cover photo"}
              </span>
            )}
          </div>
          <input
            id="coverFileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />
        </div>

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={labelStyle} htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            placeholder="What's the plan? Supports **bold**, *italic*, and [links](url)."
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: "120px",
            }}
          />
        </div>
      </div>

      {/* Step 3: Season & Tagline */}
      <div style={{ display: step === 3 ? "block" : "none" }}>
        <h2
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-2xl)",
            fontWeight: 400,
            margin: "0 0 var(--space-6) 0",
            color: "var(--ink)",
          }}
        >
          Final touches
        </h2>

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={labelStyle}>Season</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: "var(--space-2)",
            }}
          >
            {SEASONS.map((s) => (
              <label
                key={s.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "2px",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  minHeight: "44px",
                }}
              >
                <input
                  type="radio"
                  name="season"
                  value={s.value}
                  defaultChecked={s.value === "OTHER"}
                  style={{ accentColor: "var(--sea)" }}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={labelStyle} htmlFor="tagline">
            Tagline
          </label>
          <input
            id="tagline"
            name="tagline"
            type="text"
            placeholder="A short tagline for the trip"
            maxLength={200}
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <p
          style={{
            color: "var(--danger)",
            fontSize: "var(--text-sm)",
            marginBottom: "var(--space-4)",
          }}
        >
          {error}
        </p>
      )}

      {/* Navigation buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          marginTop: "var(--space-6)",
          borderTop: "1px solid var(--border)",
          paddingTop: "var(--space-6)",
        }}
      >
        <div>
          {step > 1 && (
            <button
              type="button"
              style={btnSecondary}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
          )}
        </div>

        <div>
          {step < 3 ? (
            <button
              type="button"
              style={btnPrimary}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              style={{
                ...btnPrimary,
                opacity: isPending ? 0.7 : 1,
              }}
              disabled={isPending}
            >
              {isPending ? "Creating..." : "Create trip"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
