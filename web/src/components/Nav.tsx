"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrency } from "@/lib/currency";
import { useUser } from "@/app/context/UserContext";

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
  const router = useRouter();
  const { currency, toggle } = useCurrency();
  const { user, logout } = useUser();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="border-b-2 border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-6 py-4">
        <Link href="/" className="flex min-h-11 items-center gap-2 text-lg font-extrabold tracking-tight">
          <img src="/Arbor.png" alt="Logo" className="h-8 w-8" />
          Arbor
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
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="min-h-11 border-2 border-line bg-surface px-3 font-mono text-xs font-semibold shadow-hard-sm transition-shift hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
            title="Toggle display currency"
            aria-label={`Display currency: ${currency}. Click to switch.`}
          >
            {currency} ⇄
          </button>
          {user && (
            <div className="flex items-center gap-2 border-l-2 border-line/20 pl-2">
              <span
                className="hidden font-mono text-xs text-muted sm:inline"
                title={user.address}
              >
                {user.socialId}
              </span>
              <button
                onClick={handleLogout}
                className="min-h-11 border-2 border-line bg-surface px-3 text-xs font-semibold shadow-hard-sm transition-shift hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
