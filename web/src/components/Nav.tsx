"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrency } from "@/lib/currency";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/budgets", label: "Budgets" },
  { href: "/payments", label: "Payments" },
  { href: "/automation", label: "Automation" },
  { href: "/activity", label: "Activity" },
  { href: "/company", label: "Company" },
];

export function Nav() {
  const pathname = usePathname();
  const { currency, toggle } = useCurrency();

  return (
    <header className="border-b-2 border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-6 py-4">
        <Link href="/" className="flex min-h-11 items-center text-lg font-extrabold tracking-tight">
          ArborWallet
        </Link>
        <nav className="order-last flex w-full flex-wrap items-center gap-1 md:order-none md:w-auto">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center px-3 text-sm font-medium ${
                  active
                    ? "border-2 border-line bg-accent text-ink shadow-hard-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={toggle}
          className="min-h-11 border-2 border-line bg-surface px-3 font-mono text-xs font-semibold shadow-hard-sm transition-shift hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
          title="Toggle display currency"
          aria-label={`Display currency: ${currency}. Click to switch.`}
        >
          {currency} ⇄
        </button>
      </div>
    </header>
  );
}
