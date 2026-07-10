"use client"

import { MagicLoginComponent } from "@/components/MagicLoginComponent"

export default function LoginPage() {
  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted">
            Authentication
          </p>
          <h1 className="mt-2 text-5xl font-extrabold tracking-tight">
            Login
          </h1>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Sign in with a Magic Link and continue using ArborWallet with the same modern treasury experience as the rest of the app.
        </p>
      </div>

      <div className="border-2 border-line bg-surface p-8 shadow-hard">
        <MagicLoginComponent />
      </div>
    </div>
  )
}

