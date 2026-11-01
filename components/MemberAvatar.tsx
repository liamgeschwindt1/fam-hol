"use client";

import { useState } from "react";
import { imageUrl } from "@/lib/images";

interface MemberAvatarProps {
  name: string;
  photoKey: string | null | undefined;
  size?: number;
}

const EMOJIS = ["🐬", "🌴", "🐢", "🦋", "🌻", "🦊", "🐙", "🐧", "🐨", "🌈", "🍉", "🦉"];

export function MemberAvatar({ name, photoKey, size = 48 }: MemberAvatarProps) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const photoUrl = imageUrl(photoKey);

  if (photoUrl && failedPhoto !== photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        onError={() => setFailedPhoto(photoUrl)}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  const hue = stringToHue(name);

  return (
    <div
      role="img"
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: `hsl(${hue}, 45%, 90%)`,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.52,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <span aria-hidden="true">{EMOJIS[hue % EMOJIS.length]}</span>
    </div>
  );
}

function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}
