"use client";

import { useEffect, useRef } from "react";
import { fillBar } from "@/lib/motion";

// Animated budget-consumption bar. Fill animates via scaleX (transform-only,
// no layout shift) when it enters — anime.js per SPEC.
export function Progress({
  fraction,
  label,
}: {
  fraction: number; // 0..1
  label: string; // a11y text, e.g. "62% of allocation spent"
}) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bar.current) fillBar(bar.current, fraction);
  }, [fraction]);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-3 border-2 border-line bg-bg"
    >
      <div
        ref={bar}
        className="h-full w-full origin-left bg-accent"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
