"use client";

import { useRef, useState } from "react";

interface PhotoCropperProps {
  onUploaded: (key: string) => void;
}

const MAX_SIZE = 400; // output square side in px

export function PhotoCropper({ onUploaded }: PhotoCropperProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

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

    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        cropAndUpload(img, file.type, file.name);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function cropAndUpload(img: HTMLImageElement, mimeType: string, filename: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Square-crop from center
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;

    canvas.width = MAX_SIZE;
    canvas.height = MAX_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, sx, sy, side, side, 0, 0, MAX_SIZE, MAX_SIZE);
    setPreview(canvas.toDataURL("image/jpeg", 0.92));

    // Upload
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        setUploading(true);
        try {
          // Get presigned URL
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: filename,
              contentType: "image/jpeg",
              size: blob.size,
            }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(body.error ?? "Upload failed");
          }

          const { url, key } = await res.json() as { url: string; key: string };

          // Upload to S3
          const s3Res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
          });

          if (!s3Res.ok) throw new Error("S3 upload failed");

          onUploaded(key);
          setUploaded(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
          setPreview(null);
        } finally {
          setUploading(false);
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
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
          />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-soft)" }}>
            Choose photo
          </span>
        </label>
      )}

      {error && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginTop: "var(--space-2)" }}>
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
