import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 border-2 border-line px-5 py-2.5 text-sm font-semibold transition-shift shadow-hard hover:shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line disabled:opacity-40 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-ink",
  secondary: "bg-surface text-ink",
  danger: "bg-danger text-white",
  ghost: "bg-transparent shadow-none border-transparent hover:shadow-none hover:translate-x-0 hover:translate-y-0 underline underline-offset-4",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
