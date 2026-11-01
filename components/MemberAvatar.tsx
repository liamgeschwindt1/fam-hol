interface MemberAvatarProps {
  name: string;
  photoKey: string | null | undefined;
  size?: number;
}

const S3_BASE = process.env.NEXT_PUBLIC_S3_BASE_URL ?? "";

export function MemberAvatar({ name, photoKey, size = 48 }: MemberAvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (photoKey && S3_BASE) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${S3_BASE}/${photoKey}`}
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

  // Fallback: initials avatar with a consistent colour derived from name
  const hue = stringToHue(name);

  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: `hsl(${hue}, 40%, 55%)`,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
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
