import React from "react";

/**
 * Lightweight glassmorphic background (no canvas, no RAF).
 * Safe to use behind content without causing jank.
 */
interface FuturisticBackgroundProps {
  /** Overall intensity for effects (0..1). */
  intensity?: number;
  /** Show dotted grid layer. */
  showGrid?: boolean;
  /** Extra className to merge. */
  className?: string;
  /** Optional inline styles. */
  style?: React.CSSProperties;
}

const FuturisticBackground: React.FC<FuturisticBackgroundProps> = ({
  intensity = 1,
  showGrid = true,
  className,
  style,
}) => {
  const gridOpacity = 0.06 * intensity;
  const glow1Opacity = 0.12 * intensity;
  const glow2Opacity = 0.10 * intensity;

  const rootClass = [
    "pointer-events-none absolute inset-0 z-0",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div aria-hidden className={rootClass} style={style}>
      {/* Soft radial glows */}
      <div
        className="absolute -top-[22%] -right-[12%] w-[78vw] h-[78vw] blur-3xl"
        style={{
          opacity: glow1Opacity,
          backgroundImage:
            "radial-gradient(closest-side, rgba(167,139,250,0.12) 0%, rgba(96,165,250,0.10) 45%, transparent 70%)",
          filter: "saturate(115%)",
        }}
      />
      <div
        className="absolute -top-[10%] right-[10%] w-[55vw] h-[55vw] blur-3xl"
        style={{
          opacity: glow2Opacity,
          backgroundImage:
            "radial-gradient(closest-side, rgba(96,165,250,0.10) 0%, rgba(96,165,250,0.06) 40%, transparent 70%)",
        }}
      />

      {/* Dotted grid pattern with slow drift */}
      {showGrid && (
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{
            opacity: gridOpacity,
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            backgroundPosition: "0 0",
            animation: "gridShift 80s linear infinite",
          }}
        />
      )}
    </div>
  );
};

export default FuturisticBackground;


