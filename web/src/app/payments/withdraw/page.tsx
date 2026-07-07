"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/lib/currency";
import { mockPartitions } from "@/lib/mock/data";
import { mockWallet } from "@/lib/mock/wallet";
import { ethToWei } from "@/lib/format";
import type { WithdrawResult } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { ViewInfrastructure } from "@/components/ViewInfrastructure";
import { CheckIcon } from "@/components/ui/icons";

type Step = "budget" | "details" | "review" | "done";

export default function Withdraw() {
  const { fmt } = useCurrency();
  const [step, setStep] = useState<Step>("budget");
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [invoice, setInvoice] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WithdrawResult | null>(null);

  const budget = mockPartitions.find((p) => p.id === budgetId);
  const budgets = mockPartitions.filter((p) => !p.isBackup);
  const amountWei = amount ? ethToWei(parseFloat(amount) || 0) : "0";
  const overBudget = budget ? BigInt(amountWei) > BigInt(budget.balanceWei) : false;

  async function confirm() {
    if (!budget) return;
    setBusy(true);
    const res = await mockWallet.sendWithdraw({
      partitionId: budget.id,
      to: "0x000000000000000000000000000000000000dEaD",
      amountWei,
      invoiceCidHash: "0x" + "ab".repeat(32) as `0x${string}`,
    });
    setResult(res);
    setBusy(false);
    setStep("done");
  }

  const steps: Step[] = ["budget", "details", "review", "done"];

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link href="/payments" className="text-sm text-muted underline underline-offset-4">
          ← Payments
        </Link>
        <h1 className="mt-2 text-5xl font-extrabold tracking-tight">
          Withdraw Funds
        </h1>
        <p className="mt-2 font-mono text-xs text-muted">
          Step {steps.indexOf(step) + 1} of 4
        </p>
      </div>

      {step === "budget" && (
        <div className="space-y-3">
          <p className="font-medium">Which budget?</p>
          {budgets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setBudgetId(p.id);
                setStep("details");
              }}
              className="flex w-full items-center justify-between border-2 border-line bg-surface p-4 text-left shadow-hard transition-shift hover:shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              <span className="font-medium">{p.label}</span>
              <span className="font-bold">{fmt(p.balanceWei)} available</span>
            </button>
          ))}
        </div>
      )}

      {step === "details" && budget && (
        <div className="space-y-5 border-2 border-line bg-surface p-6 shadow-hard">
          <div>
            <label htmlFor="wd-amount" className="text-sm font-medium">Amount (ETH)</label>
            <input
              id="wd-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full border-2 border-line bg-bg px-3 py-2 font-mono text-lg outline-none focus:border-accent"
              placeholder="0.00"
            />
            {overBudget && (
              <p className="mt-2 text-sm font-semibold text-danger">
                This budget doesn&apos;t have that much. You can request a limit
                increase from your admin.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="wd-invoice" className="text-sm font-medium">Invoice (required)</label>
            <input
              id="wd-invoice"
              type="file"
              onChange={(e) => setInvoice(e.target.files?.[0] ?? null)}
              className="mt-1 w-full border-2 border-line bg-bg px-3 py-2 text-base file:mr-3 file:border-2 file:border-line file:bg-surface file:px-3 file:py-1 file:text-sm file:font-medium"
            />
            <p className="mt-1 text-xs text-muted">
              An invoice is required for every payment.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setStep("budget")}>Back</Button>
            <Button
              variant="primary"
              disabled={!amount || parseFloat(amount) <= 0 || !invoice || overBudget}
              onClick={() => setStep("review")}
            >
              Review
            </Button>
          </div>
        </div>
      )}

      {step === "review" && budget && (
        <div className="space-y-5">
          <div className="border-2 border-line bg-surface p-6 shadow-hard">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">From budget</span>
                <span className="font-medium">{budget.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Amount</span>
                <span className="text-xl font-bold">{fmt(amountWei)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Invoice</span>
                <span className="font-mono text-xs">{invoice?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Network fee</span>
                <span className="font-medium text-success-text">
                  None — company covers it
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Permission</span>
                <StatusChip status="granted" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button onClick={() => setStep("details")} disabled={busy}>
                Back
              </Button>
              <Button variant="primary" onClick={confirm} disabled={busy}>
                {busy ? "Confirming…" : "Confirm Payment"}
              </Button>
            </div>
          </div>
          <ViewInfrastructure
            rows={[
              { label: "Signer", value: "ZeroDev session key (scope: withdraw() only)" },
              { label: "Account", value: "Kernel smart account · ERC-4337" },
              { label: "Fee", value: "Sponsored by company paymaster" },
              { label: "Invoice storage", value: "IPFS via Pinata (mock)" },
            ]}
          />
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-5">
          <div className="border-2 border-line bg-surface p-8 text-center shadow-hard-lg">
            <CheckIcon className="mx-auto h-14 w-14 text-success-text" />
            <h2 className="mt-3 text-3xl font-bold">Payment Sent</h2>
            <p className="mt-2 text-xl font-bold tabular-nums text-accent-text">{fmt(amountWei)}</p>
            <p className="mt-1 text-sm text-muted">
              Settled instantly. No network fee.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/activity">
                <Button>View Activity</Button>
              </Link>
              <Link href="/">
                <Button variant="primary">Done</Button>
              </Link>
            </div>
          </div>
          <ViewInfrastructure
            rows={[
              { label: "UserOp hash", value: result.userOpHash },
              { label: "Tx hash", value: result.txHash },
              { label: "Sponsored", value: String(result.sponsored) },
              { label: "Network", value: "Arbitrum Sepolia (421614)" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
