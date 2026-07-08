import type { HTMLAttributes } from "react";

// Brutalist surface primitives — dedupe the border-2/shadow-hard soup.
const base = "border-2 border-line bg-surface";

const variants = {
  static: `${base} shadow-hard`,
  interactive: `${base} shadow-hard transition-shift hover:shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px]`,
  flat: base,
} as const;

export function Card({
  variant = "static",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof variants }) {
  return <div className={`${variants[variant]} ${className}`} {...props} />;
}
