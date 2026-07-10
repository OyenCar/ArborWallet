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
  const {
    user,
    loading,
    usingFirebase,
    login,
    signup,
    loginWithGoogle,
    loginWithGithub,
    loginWithTelegram,
  } = useUser();
  
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [showTgModal, setShowTgModal] = useState(false);
  const [tgUsername, setTgUsername] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // already authenticated → redirect to intended page
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email or username.");
      return;
    }
    if (usingFirebase && !password) {
      setError("Please enter your password.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace(next);
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : "Authentication failed.";
      if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) {
        setError("Invalid email or password. Please try again.");
      } else if (msg.includes("auth/user-not-found")) {
        setError("No account found with this email. Try signing up first.");
      } else if (msg.includes("auth/too-many-requests")) {
        setError("Too many login attempts. Please wait a moment and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email or username.");
      return;
    }
    if (usingFirebase && !password) {
      setError("Please enter a password (min. 6 characters).");
      return;
    }
    if (usingFirebase && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signup(email.trim(), password);
      router.replace(next);
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : "Registration failed.";
      if (msg.includes("auth/email-already-in-use")) {
        setError("An account with this email already exists. Try signing in.");
      } else if (msg.includes("auth/weak-password")) {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (msg.includes("auth/invalid-email")) {
        setError("Invalid email format. Please check and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setError(null);
    try {
      await loginWithGoogle();
      router.replace(next);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Google authentication failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGithubLogin() {
    setBusy(true);
    setError(null);
    try {
      await loginWithGithub();
      router.replace(next);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "GitHub authentication failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleTelegramSubmit() {
    if (!tgUsername.trim()) {
      setError("Please enter your Telegram username.");
      setShowTgModal(false);
      return;
    }
    setBusy(true);
    setError(null);
    setShowTgModal(false);
    try {
      await loginWithTelegram(tgUsername);
      router.replace(next);
    } catch (err: unknown) {
      console.error(err);
      setError("Telegram connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMock(socialId: string) {
    setBusy(true);
    setError(null);
    try {
      await login(socialId, "");
      router.replace(next);
    } catch (err: unknown) {
      console.error(err);
      setError("Mock login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-8 py-10">
      {/* Brand Header */}
      <div className="text-center">
        <span className="inline-block border-2 border-line bg-accent text-ink font-mono text-xs uppercase px-2.5 py-0.5 font-bold mb-3.5 shadow-hard-sm">
          Treasury Operating System
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight">ArborWallet</h1>
        <p className="mt-2 text-sm text-muted">
          Corporate financial partitions built secure on Ethereum
        </p>
      </div>

      {/* Main Login Card */}
      <div className="border-2 border-line bg-surface p-7 shadow-hard space-y-6">
        {/* Tab Switcher */}
        <div className="flex border-2 border-line p-1 bg-bg shadow-hard-sm">
          <button
            onClick={() => {
              setActiveTab("signin");
              setError(null);
            }}
            className={`flex-1 py-2 text-center text-sm font-bold transition-all ${
              activeTab === "signin"
                ? "bg-accent text-ink border-2 border-line shadow-hard-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setActiveTab("signup");
              setError(null);
            }}
            className={`flex-1 py-2 text-center text-sm font-bold transition-all ${
              activeTab === "signup"
                ? "bg-accent text-ink border-2 border-line shadow-hard-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div
            className="border-2 border-danger bg-danger/5 p-3.5 text-sm font-semibold text-danger"
            role="alert"
          >
            {error}
          </div>
        )}

        {activeTab === "signin" ? (
          /* ── SIGN IN FORM ─────────────────────────────────────────────── */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-ink mb-1.5">
                {usingFirebase ? "Email Address" : "Email or Social ID"}
              </label>
              <input
                type={usingFirebase ? "email" : "text"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  usingFirebase ? "name@company.com" : "e.g. budi or budi@company.com"
                }
                className="w-full border-2 border-line bg-surface px-4 py-2.5 font-mono text-sm focus:outline-none focus:bg-bg focus:ring-2 focus:ring-accent shadow-hard-sm"
                disabled={busy}
              />
            </div>

            {usingFirebase && (
              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full border-2 border-line bg-surface px-4 py-2.5 font-mono text-sm focus:outline-none focus:bg-bg focus:ring-2 focus:ring-accent shadow-hard-sm"
                  disabled={busy}
                />
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Button
                variant="primary"
                className="w-full"
                disabled={busy}
                type="submit"
              >
                {busy
                  ? "Signing in…"
                  : usingFirebase
                    ? "Sign In with Email"
                    : "Sign In (Demo)"}
              </Button>

              {/* Social Login Options */}
              {usingFirebase && (
                <>
                  <div className="flex items-center my-3">
                    <div className="flex-1 border-t-2 border-line/10" />
                    <span className="px-3 text-xs font-bold text-muted uppercase">or continue with</span>
                    <div className="flex-1 border-t-2 border-line/10" />
                  </div>

                  <div className="flex justify-center gap-4 py-1">
                    {/* Google Button */}
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={busy}
                      title="Google"
                      className="w-12 h-12 rounded-full border-2 border-line bg-surface flex items-center justify-center shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-shift disabled:opacity-50 cursor-pointer"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M21.35 11.1h-9.17v2.73h6.51c-.33 1.56-1.56 2.95-3.18 3.5v2.88h5.08c2.97-2.73 4.67-6.73 4.67-11.45 0-.58-.06-1.15-.17-1.66z"
                        />
                        <path
                          fill="#34A853"
                          d="M12.18 21.43c2.75 0 5.06-.92 6.75-2.5l-5.08-2.88c-.79.53-1.8.85-2.91.85-2.24 0-4.14-1.52-4.82-3.56H.9v3.02c1.7 3.37 5.21 5.67 9.28 5.67z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M7.36 13.34a5.72 5.72 0 0 1 0-3.68V6.64H.9a9.99 9.99 0 0 0 0 9.72l6.46-3.02z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12.18 5.57c1.49 0 2.84.51 3.9 1.5l2.92-2.92A9.92 9.92 0 0 0 12.18 1.5C8.11 1.5 4.6 3.8 2.9 7.17l6.46 3.02c.68-2.04 2.58-3.56 4.82-3.56z"
                        />
                      </svg>
                    </button>

                    {/* GitHub Button */}
                    <button
                      type="button"
                      onClick={handleGithubLogin}
                      disabled={busy}
                      title="GitHub"
                      className="w-12 h-12 rounded-full border-2 border-line bg-surface flex items-center justify-center shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-shift disabled:opacity-50 cursor-pointer"
                    >
                      <svg className="w-5.5 h-5.5 text-ink" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                      </svg>
                    </button>

                    {/* Telegram Button */}
                    <button
                      type="button"
                      onClick={() => setShowTgModal(true)}
                      disabled={busy}
                      title="Telegram"
                      className="w-12 h-12 rounded-full border-2 border-line bg-surface flex items-center justify-center shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-shift disabled:opacity-50 cursor-pointer"
                    >
                      <svg className="w-5.5 h-5.5 text-[#229ED9]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.98 1.25-5.59 3.69-.53.36-1 .53-1.42.52-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.36-.49.99-.74 3.87-1.68 6.45-2.79 7.74-3.33 3.69-1.54 4.45-1.81 4.95-1.82.11 0 .36.03.52.16.14.11.18.26.2.37.02.13.03.36.01.52z"/>
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {usingFirebase && (
              <p className="text-center text-xs text-muted pt-1 leading-relaxed">
                Secured by Firebase Authentication. Your wallet is managed by
                Magic Server Wallet on Ethereum.
              </p>
            )}

            {/* Quick Access Section */}
            {!usingFirebase && (
              <div className="pt-5 border-t-2 border-line/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    Quick Access Demo Accounts
                  </span>
                  <span className="text-[10px] bg-warning/10 border border-warning text-warning-text px-1.5 py-0.5 font-mono font-bold uppercase">
                    Demo Mode
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {mockUsers.map((u) => (
                    <button
                      key={u.socialId}
                      type="button"
                      onClick={() => submitMock(u.socialId)}
                      disabled={busy}
                      className="flex items-center justify-between border-2 border-line bg-surface hover:bg-bg px-4 py-2.5 text-left shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-shift disabled:opacity-50 text-sm font-semibold cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs">{u.socialId}</span>
                      </span>
                      <span className="font-mono text-xs text-muted">
                        {truncAddr(u.address)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        ) : (
          /* ── SIGN UP FORM ────────────────────────────────────────────── */
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-ink mb-1.5">
                {usingFirebase ? "Email Address" : "Preferred Email or Username"}
              </label>
              <input
                type={usingFirebase ? "email" : "text"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={usingFirebase ? "name@company.com" : "e.g. alex"}
                className="w-full border-2 border-line bg-surface px-4 py-2.5 font-mono text-sm focus:outline-none focus:bg-bg focus:ring-2 focus:ring-accent shadow-hard-sm"
                disabled={busy}
              />
            </div>

            {usingFirebase && (
              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full border-2 border-line bg-surface px-4 py-2.5 font-mono text-sm focus:outline-none focus:bg-bg focus:ring-2 focus:ring-accent shadow-hard-sm"
                  disabled={busy}
                />
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Button
                variant="primary"
                className="w-full"
                disabled={busy}
                type="submit"
              >
                {busy
                  ? "Creating account…"
                  : usingFirebase
                    ? "Create Account & Wallet"
                    : "Create Account & Sign In"}
              </Button>

              {/* Social Signup Options */}
              {usingFirebase && (
                <>
                  <div className="flex items-center my-3">
                    <div className="flex-1 border-t-2 border-line/10" />
                    <span className="px-3 text-xs font-bold text-muted uppercase">or continue with</span>
                    <div className="flex-1 border-t-2 border-line/10" />
                  </div>

                  <div className="flex justify-center gap-4 py-1">
                    {/* Google Button */}
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={busy}
                      title="Google"
                      className="w-12 h-12 rounded-full border-2 border-line bg-surface flex items-center justify-center shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-shift disabled:opacity-50 cursor-pointer"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M21.35 11.1h-9.17v2.73h6.51c-.33 1.56-1.56 2.95-3.18 3.5v2.88h5.08c2.97-2.73 4.67-6.73 4.67-11.45 0-.58-.06-1.15-.17-1.66z"
                        />
                        <path
                          fill="#34A853"
                          d="M12.18 21.43c2.75 0 5.06-.92 6.75-2.5l-5.08-2.88c-.79.53-1.8.85-2.91.85-2.24 0-4.14-1.52-4.82-3.56H.9v3.02c1.7 3.37 5.21 5.67 9.28 5.67z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M7.36 13.34a5.72 5.72 0 0 1 0-3.68V6.64H.9a9.99 9.99 0 0 0 0 9.72l6.46-3.02z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12.18 5.57c1.49 0 2.84.51 3.9 1.5l2.92-2.92A9.92 9.92 0 0 0 12.18 1.5C8.11 1.5 4.6 3.8 2.9 7.17l6.46 3.02c.68-2.04 2.58-3.56 4.82-3.56z"
                        />
                      </svg>
                    </button>

                    {/* GitHub Button */}
                    <button
                      type="button"
                      onClick={handleGithubLogin}
                      disabled={busy}
                      title="GitHub"
                      className="w-12 h-12 rounded-full border-2 border-line bg-surface flex items-center justify-center shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-shift disabled:opacity-50 cursor-pointer"
                    >
                      <svg className="w-5.5 h-5.5 text-ink" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                      </svg>
                    </button>

                    {/* Telegram Button */}
                    <button
                      type="button"
                      onClick={() => setShowTgModal(true)}
                      disabled={busy}
                      title="Telegram"
                      className="w-12 h-12 rounded-full border-2 border-line bg-surface flex items-center justify-center shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-shift disabled:opacity-50 cursor-pointer"
                    >
                      <svg className="w-5.5 h-5.5 text-[#229ED9]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.98 1.25-5.59 3.69-.53.36-1 .53-1.42.52-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.36-.49.99-.74 3.87-1.68 6.45-2.79 7.74-3.33 3.69-1.54 4.45-1.81 4.95-1.82.11 0 .36.03.52.16.14.11.18.26.2.37.02.13.03.36.01.52z"/>
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {usingFirebase ? (
              <p className="text-center text-xs text-muted pt-2 leading-relaxed">
                Creates a Firebase account and an Ethereum wallet via Magic
                Server Wallet. No seed phrase required.
              </p>
            ) : (
              <p className="text-center text-xs text-muted pt-2 leading-relaxed">
                Demo mode: Creates a simulated account with a random public key.
              </p>
            )}
          </form>
        )}
      </div>

      {/* Telegram User Entry Modal */}
      {showTgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
          <div className="border-2 border-line bg-surface p-6 shadow-hard w-full max-w-sm space-y-4">
            <div className="flex justify-between items-center border-b-2 border-line pb-2">
              <h3 className="font-bold text-lg text-ink">Connect Telegram</h3>
              <button
                type="button"
                onClick={() => setShowTgModal(false)}
                className="text-muted hover:text-ink font-bold font-mono cursor-pointer"
              >
                [X]
              </button>
            </div>
            <p className="text-xs text-muted">
              Enter your Telegram handle. We will generate a secure wallet associated with your Telegram account.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase text-ink">Telegram Username</label>
              <input
                type="text"
                value={tgUsername}
                onChange={(e) => setTgUsername(e.target.value)}
                placeholder="e.g. @username"
                className="w-full border-2 border-line bg-surface px-4 py-2.5 font-mono text-sm focus:outline-none focus:bg-bg focus:ring-2 focus:ring-accent shadow-hard-sm"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTgModal(false)}
                className="flex-1 border-2 border-line bg-surface py-2 text-sm font-semibold hover:bg-bg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTelegramSubmit}
                className="flex-1 border-2 border-line bg-accent text-ink py-2 text-sm font-semibold shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-shift cursor-pointer"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
