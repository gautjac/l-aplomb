interface PlumbMarkProps {
  size?: number;
  swing?: boolean;
  /** tone of the bob: aplomb (green), relache (amber), alarme, or neutral */
  tone?: "aplomb" | "relache" | "alarme" | "neutral";
  className?: string;
}

const BOB: Record<NonNullable<PlumbMarkProps["tone"]>, string> = {
  aplomb: "#1aa179",
  relache: "#e0a32e",
  alarme: "#d56a4a",
  neutral: "#0d5d59",
};

/** The plumb-line motif: a vertical thread with a bob, the app's whole metaphor. */
export function PlumbMark({
  size = 64,
  swing = false,
  tone = "neutral",
  className = "",
}: PlumbMarkProps) {
  const bob = BOB[tone];
  return (
    <svg
      viewBox="0 0 64 90"
      width={size}
      height={(size * 90) / 64}
      className={className}
      aria-hidden="true"
    >
      {/* anchor */}
      <rect x="22" y="4" width="20" height="5" rx="2.5" fill="#9fb6b3" />
      {/* thread */}
      <line
        x1="32"
        y1="9"
        x2="32"
        y2="58"
        stroke="#9fb6b3"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* the swinging bob group */}
      <g
        className={swing ? "animate-swing" : ""}
        style={{ transformOrigin: "32px 9px" }}
      >
        <line
          x1="32"
          y1="9"
          x2="32"
          y2="58"
          stroke={bob}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.45"
        />
        {/* conical plumb bob */}
        <path d="M32 56 L40 70 A8 9 0 0 1 24 70 Z" fill={bob} />
        <ellipse cx="32" cy="70" rx="8" ry="3" fill={bob} opacity="0.7" />
        <circle cx="32" cy="63" r="2" fill="#0e2a2e" opacity="0.35" />
        <path d="M32 78 L33 84 L31 84 Z" fill={bob} />
      </g>
    </svg>
  );
}
