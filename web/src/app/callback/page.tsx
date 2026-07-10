"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Firebase popups handle the auth handshake directly on the login page,
// rendering this callback redirect landing page obsolete.
export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-20 text-center">
      <div className="mx-auto h-8 w-40 animate-pulse bg-line/10" />
      <p className="text-sm text-muted">Completing sign-in…</p>
    </div>
  );
}
