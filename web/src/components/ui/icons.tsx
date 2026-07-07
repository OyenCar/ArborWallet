// Inline SVG icons — consistent 2px stroke, no emoji/unicode glyphs as icons.
import type { SVGProps } from "react";

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="square"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function ScanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
      <rect x="8" y="8" width="8" height="8" />
    </svg>
  );
}
