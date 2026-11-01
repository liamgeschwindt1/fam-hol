"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/images";

interface PhotoCropperProps {
  onUploaded: (key: string) => void | Promise<void>;
  onUploadingChange?: (uploading: boolean) => void;
}

const MAX_SIZE = 400; // output square side in px

export function PhotoCropper({ onUploaded, onUploadingChange }: PhotoCropperProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  function setBusy(busy: boolean) {
    setUploading(busy);
    onUploadingChange?.(busy);
  }

  function fail(message: string) {
    setError(message);
    setPreview(null);
    setBusy(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploaded(false);
    setPreview(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Image must be under 12 MB.");
      return;
    }

    setBusy(true);
    const reader = new FileReader();
    reader.onerror = () => fail("Could not read this photo. Please choose another image.");
    reader.onload = (evt) => {
      const src = evt.target?.result;
      if (typeof src !== "string") {
        fail("Could not read this photo. Please choose another image.");
        return;
      }
      const img = new Image();
      img.onerror = () => fail("This image format could not be read. Try a JPEG or PNG photo.");
      img.onload = () => {
        cropAndUpload(img, file.name);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function cropAndUpload(img: HTMLImageElement, filename: string) {
    const canvas = canvasRef.current;
    if (!canvas) {
      fail("Photo editor is unavailable. Please try again.");
      return;
    }

    // Square-crop from center
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;

    canvas.width = MAX_SIZE;
    canvas.height = MAX_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      fail("Photo editor is unavailable in this browser.");
      return;
    }

    ctx.drawImage(img, sx, sy, side, side, 0, 0, MAX_SIZE, MAX_SIZE);
    setPreview(canvas.toDataURL("image/jpeg", 0.92));

    // Upload
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          fail("Could not prepare this photo. Please try another image.");
          return;
        }
        try {
          const key = await uploadImage(blob, filename);
          await onUploaded(key);
          setUploaded(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
          setPreview(null);
        } finally {
          setBusy(false);
        }
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div>
      {/* Hidden canvas for cropping */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {preview ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Your photo preview"
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid var(--border)",
            }}
          />
          <div>
            {uploading && (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-soft)" }}>
                Uploading…
              </p>
            )}
            {uploaded && (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--success)" }}>
                Photo saved
              </p>
            )}
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setPreview(null);
                setUploaded(false);
                if (fileRef.current) fileRef.current.value = "";
              }}
              style={changeBtnStyle}
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <label style={uploadLabelStyle}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
          />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-soft)" }}>
            {uploading ? "Preparing photo…" : "Choose photo (optional)"}
          </span>
        </label>
      )}

      {error && (
        <p role="alert" style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginTop: "var(--space-2)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

const uploadLabelStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "44px",
  padding: "0 var(--space-4)",
  border: "1px dashed var(--border)",
  borderRadius: "4px",
  cursor: "pointer",
  minWidth: "140px",
};

const changeBtnStyle: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--sea)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
};
