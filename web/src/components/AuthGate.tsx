"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { auth, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !auth?.socialId) {
      router.replace("/login");
    }
  }, [auth, isLoading, router]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted">Loading…</div>;
  }

  if (!auth?.socialId) {
    return null;
  }

  return <>{children}</>;
}
