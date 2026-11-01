"use client";

import { useActionState, useEffect, useState } from "react";
import type { Season } from "@prisma/client";
import { updateTrip } from "./actions";
import { uploadImage } from "@/lib/images";

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

interface EditTripModalProps {
  tripId: string;
  initialData: {
    title: string;
    tagline: string | null;
    description: string;
    startDate: string | null;
    endDate: string | null;
    season: Season;
  };
  onClose: () => void;
}

export function EditTripModal({
  tripId,
  initialData,
  onClose,
}: EditTripModalProps) {
  const [coverImageKey, setCoverImageKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const [error, formAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      try {
        formData.set("tripId", tripId);
        if (coverImageKey) {
          formData.set("coverImageKey", coverImageKey);
        }
        await updateTrip(formData);
        onClose();
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
    setUploadError(null);
    setCoverImageKey("");
    setCoverPreview(null);
    try {
      const key = await uploadImage(file, file.name);
      setCoverImageKey(key);
      setCoverPreview(URL.createObjectURL(file));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--paper)",
          border: "1px solid var(--border)",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "var(--space-8)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-2xl)",
            fontWeight: 400,
            margin: "0 0 var(--space-6) 0",
            color: "var(--ink)",
          }}
        >
          Edit trip
        </h2>

        <form action={formAction}>
          <input type="hidden" name="tripId" value={tripId} />

          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={labelStyle} htmlFor="edit-title">
              Title
            </label>
            <input
              id="edit-title"
              name="title"
              type="text"
              defaultValue={initialData.title}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={labelStyle} htmlFor="edit-tagline">
              Tagline
            </label>
            <input
              id="edit-tagline"
              name="tagline"
              type="text"
              defaultValue={initialData.tagline ?? ""}
              maxLength={200}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={labelStyle} htmlFor="edit-description">
              Description
            </label>
            <textarea
              id="edit-description"
              name="description"
              rows={4}
              defaultValue={initialData.description}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: "100px",
              }}
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
              <label style={labelStyle} htmlFor="edit-startDate">
                Start date
              </label>
              <input
                id="edit-startDate"
                name="startDate"
                type="date"
                defaultValue={initialData.startDate ?? ""}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="edit-endDate">
                End date
              </label>
              <input
                id="edit-endDate"
                name="endDate"
                type="date"
                defaultValue={initialData.endDate ?? ""}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={labelStyle}>Season</label>
            <select
              name="season"
              defaultValue={initialData.season}
              style={inputStyle}
            >
              {SEASONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "var(--space-6)" }}>
            <label style={labelStyle}>New cover photo</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              disabled={uploading}
              style={{ fontSize: "var(--text-sm)" }}
            />
            {coverPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="New cover preview" style={{ width: "100%", marginTop: "12px", borderRadius: "12px" }} />
            )}
            {uploadError && <p role="alert" style={{ color: "var(--danger)" }}>{uploadError}</p>}
            {uploading && (
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-soft)",
                  marginLeft: "var(--space-2)",
                }}
              >
                Uploading...
              </span>
            )}
            {coverImageKey && !uploading && (
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--moss)",
                  marginLeft: "var(--space-2)",
                }}
              >
                Uploaded
              </span>
            )}
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

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
              borderTop: "1px solid var(--border)",
              paddingTop: "var(--space-4)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: "44px",
                padding: "0 20px",
                fontSize: "var(--text-sm)",
                fontFamily: "var(--font-hanken)",
                backgroundColor: "transparent",
                color: "var(--text-soft)",
                border: "1px solid var(--border)",
                borderRadius: "2px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || uploading}
              style={{
                minHeight: "44px",
                padding: "0 20px",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                fontFamily: "var(--font-hanken)",
                backgroundColor: "var(--sea)",
                color: "#fff",
                border: "none",
                borderRadius: "2px",
                cursor: "pointer",
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
