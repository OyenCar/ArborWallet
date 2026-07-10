"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { useMagic } from "@/app/context/MagicProvider";

// OAuth landing page — Magic redirects here after Google. Finishes the
// handshake, then bounces to the dashboard.
export default function CallbackPage() {
  const { finishOAuth } = useUser();
  const { magic } = useMagic(); // wait until Magic is initialised
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!magic || ran.current) return; // magic still initialising → wait
    ran.current = true;
    (async () => {
      try {
        await finishOAuth();
        router.replace("/");
      } catch (e) {
        console.error("OAuth callback failed:", e);
        setError("Sign-in could not be completed. Please try again.");
      }
    })();
  }, [magic, finishOAuth, router]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-20 text-center">
      {error ? (
        <>
          <p className="text-lg font-semibold text-danger" role="alert">
            {error}
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="text-sm text-accent-text underline underline-offset-4"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <div className="mx-auto h-8 w-40 animate-pulse bg-line/10" />
          <p className="text-sm text-muted">Completing sign-in…</p>
        </>
      )}
    </div>
  );
}
