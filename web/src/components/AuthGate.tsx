"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

interface AuthGateProps {
  children: React.ReactNode;
  allowedUnauthenticatedPaths?: string[];
}

export function AuthGate({ children, allowedUnauthenticatedPaths = ["/login"] }: AuthGateProps) {
  const { auth, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthPage = allowedUnauthenticatedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (isAuthPage && auth?.socialId) {
      router.replace("/");
      return;
    }

    if (!isAuthPage && !auth?.socialId) {
      router.replace("/login");
    }
  }, [auth, isAuthPage, isLoading, router]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted">Loading…</div>;
  }

  if (!isAuthPage && !auth?.socialId) {
    return null;
  }

  return <>{children}</>;
}
