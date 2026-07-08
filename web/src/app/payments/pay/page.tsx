"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/lib/currency";
import { mockPartitions } from "@/lib/mock/data";
import { mockWallet } from "@/lib/mock/wallet";
import { ethToWei, truncAddr } from "@/lib/format";
import type { WithdrawResult } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { ViewInfrastructure } from "@/components/ViewInfrastructure";
import { CheckIcon, ScanIcon } from "@/components/ui/icons";
import { AnimatedAmount } from "@/components/ui/AnimatedAmount";
import { popIn } from "@/lib/motion";

// Scan-to-pay: vendor shows a static address QR (EIP-681), employee scans.
// Camera scanning lands with the real wallet layer; mock uses a simulated scan.
export default function PayVendor() {
  const { fmt } = useCurrency();
  const [scanned, setScanned] = useState<`0x${string}` | null>(null);
  const [budgetId, setBudgetId] = useState(mockPartitions[0].id);
  const [amount, setAmount] = useState("");
  const [invoice, setInvoice] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WithdrawResult | null>(null);
  const successIcon = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result && successIcon.current) popIn(successIcon.current);
  }, [result]);

  const amountWei = amount ? ethToWei(parseFloat(amount) || 0) : "0";
  const budgets = mockPartitions.filter((p) => !p.isBackup);

  async function pay() {
    if (!scanned) return;
    setBusy(true);
    const res = await mockWallet.sendWithdraw({
      partitionId: budgetId,
      to: scanned,
      amountWei,
      invoiceCidHash: ("0x" + "cd".repeat(32)) as `0x${string}`,
    });
    setResult(res);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link href="/payments" className="text-sm text-muted underline underline-offset-4">
          ← Payments
        </Link>
        <h1 className="mt-2 text-5xl font-extrabold tracking-tight">
          Pay a Vendor
        </h1>
      </div>

      {!scanned && (
        <div className="border-2 border-dashed border-line bg-surface p-10 text-center shadow-hard">
          <ScanIcon className="mx-auto h-16 w-16 text-ink" />
          <p className="mt-4 font-medium">Point your camera at the vendor&apos;s QR code</p>
          <p className="mt-1 text-sm text-muted">
            The vendor doesn&apos;t need an ArborWallet account — any payment QR works.
          </p>
          <Button
            variant="primary"
            className="mt-6"
            onClick={() =>
              setScanned("0x9F8e7D6c5B4a3F2e1D0c9B8a7F6e5D4c3B2a1F0e")
            }
          >
            Simulate Scan
          </Button>
        </div>
      )}

      {scanned && !result && (
        <div className="space-y-5 border-2 border-line bg-surface p-6 shadow-hard">
          <div className="flex items-center justify-between border-2 border-success bg-success/10 px-4 py-2">
            <span className="text-sm font-semibold text-success-text">Vendor detected</span>
            <span className="font-mono text-xs">{truncAddr(scanned)}</span>
          </div>
          <div>
            <label htmlFor="pay-budget" className="text-sm font-medium">From budget</label>
            <select
              id="pay-budget"
              value={budgetId}
              onChange={(e) => setBudgetId(e.target.value)}
              className="mt-1 w-full border-2 border-line bg-bg px-3 py-2 text-base outline-none focus:border-accent"
            >
              {budgets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {fmt(p.balanceWei)} available
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pay-amount" className="text-sm font-medium">Amount (ETH)</label>
            <input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full border-2 border-line bg-bg px-3 py-2 font-mono text-lg outline-none focus:border-accent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="pay-invoice" className="text-sm font-medium">Invoice (required)</label>
            <input
              id="pay-invoice"
              type="file"
              onChange={(e) => setInvoice(e.target.files?.[0] ?? null)}
              className="mt-1 w-full border-2 border-line bg-bg px-3 py-2 text-base file:mr-3 file:border-2 file:border-line file:bg-surface file:px-3 file:py-1 file:text-sm file:font-medium"
            />
          </div>
          <Button
            variant="primary"
            className="w-full"
            disabled={!amount || parseFloat(amount) <= 0 || !invoice || busy}
            onClick={pay}
          >
            {busy ? "Paying…" : `Confirm Payment${amount ? ` · ${fmt(amountWei)}` : ""}`}
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="border-2 border-line bg-surface p-8 text-center shadow-hard-lg">
            <div ref={successIcon} className="mx-auto w-fit">
              <CheckIcon className="h-14 w-14 text-success-text" />
            </div>
            <h2 className="mt-3 text-3xl font-bold">Vendor Paid</h2>
            <p className="mt-2 text-xl font-bold text-accent-text">
              <AnimatedAmount wei={amountWei} />
            </p>
            <p className="mt-1 text-sm text-muted">
              Funds arrived in the vendor&apos;s account. Nothing more to do.
            </p>
            <Link href="/" className="mt-6 inline-block">
              <Button variant="primary">Done</Button>
            </Link>
          </div>
          <ViewInfrastructure
            rows={[
              { label: "Recipient", value: scanned! },
              { label: "UserOp hash", value: result.userOpHash },
              { label: "Tx hash", value: result.txHash },
              { label: "QR format", value: "EIP-681 (ethereum:<address>)" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
