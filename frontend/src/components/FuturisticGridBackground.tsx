import React from "react";

// Lightweight background (no canvas) to avoid performance issues
const FuturisticGridBackground: React.FC = () => {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {/* Dotted grid pattern with slow drift */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0",
          animation: "gridShift 80s linear infinite",
        }}
      />
    </div>
  );
};

export default FuturisticGridBackground;
