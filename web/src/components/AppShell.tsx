"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { Nav } from "@/components/Nav";

const PUBLIC_ROUTES = ["/login"];

// Client auth gate: unauthenticated users are redirected to /login (with a
// ?next= return path). Public routes render bare (no Nav).
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [loading, user, isPublic, pathname, router]);

  if (isPublic) {
    return <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>;
  }

  if (loading || !user) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="h-8 w-40 animate-pulse bg-line/10" />
        <p className="mt-4 text-sm text-muted">Loading your treasury…</p>
      </main>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </>
  );
}
