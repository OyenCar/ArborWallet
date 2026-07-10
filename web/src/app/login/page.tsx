"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { mockUsers } from "@/lib/mock/data";
import { truncAddr } from "@/lib/format";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { user, loading, usingMagic, login } = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // already authed → bounce to intended page
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  async function connectMagic() {
    setBusy(true);
    setError(null);
    try {
      await login(); // opens Magic's built-in Login UI (email OTP)
      router.replace(next);
    } catch {
      setError("Login was cancelled or failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMock(socialId: string) {
    setBusy(true);
    setError(null);
    try {
      await login(socialId);
      router.replace(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-8 py-10">
      <div>
        <h1 className="text-5xl font-extrabold tracking-tight">Sign in</h1>
        <p className="mt-2 text-muted">
          Access your company treasury. No password — a secure link is sent to
          your email.
        </p>
      </div>

      {usingMagic ? (
        <div className="space-y-4 border-2 border-line bg-surface p-6 shadow-hard">
          {error && (
            <p className="text-sm font-semibold text-danger" role="alert">
              {error}
            </p>
          )}
          <Button
            variant="primary"
            className="w-full"
            disabled={busy}
            onClick={connectMagic}
          >
            {busy ? "Opening Magic…" : "Sign in with email"}
          </Button>
          <p className="text-center text-xs text-muted">
            Secured by Magic · embedded wallet, no seed phrase. Enter your email
            in the popup to receive a one-time code.
          </p>
        </div>
      ) : (
        <div className="space-y-3 border-2 border-line bg-surface p-6 shadow-hard">
          <p className="text-sm font-medium">
            Demo mode — pick an account to sign in as:
          </p>
          <p className="text-xs text-muted">
            Magic isn&apos;t configured (no API key). Set{" "}
            <code className="font-mono">NEXT_PUBLIC_MAGIC_API_KEY</code> to
            enable real email login.
          </p>
          <div className="space-y-2 pt-2">
            {mockUsers.map((u) => (
              <button
                key={u.socialId}
                onClick={() => submitMock(u.socialId)}
                disabled={busy}
                className="flex w-full items-center justify-between border-2 border-line bg-bg px-4 py-3 text-left shadow-hard-sm transition-shift hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
              >
                <span>
                  <span className="font-mono font-medium">{u.socialId}</span>{" "}
                  <span className="ml-2 text-xs uppercase text-muted">
                    {u.role}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted">
                  {truncAddr(u.address)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
