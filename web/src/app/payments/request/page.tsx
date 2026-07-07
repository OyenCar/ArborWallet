"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCurrency } from "@/lib/currency";
import { mockPartitions } from "@/lib/mock/data";
import { mockWallet } from "@/lib/mock/wallet";
import { ethToWei } from "@/lib/format";
import type { PaymentIntent } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { ViewInfrastructure } from "@/components/ViewInfrastructure";

function Countdown({ until, onExpire }: { until: string; onExpire: () => void }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => {
      const ms = new Date(until).getTime() - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) onExpire();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until, onExpire]);
  const m = Math.floor(left / 60);
  const s = left % 60;
  return (
    <span className={`font-mono text-2xl font-bold ${left < 30 ? "text-danger" : ""}`}>
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

export default function RequestQR() {
  const { fmt } = useCurrency();
  const [budgetId, setBudgetId] = useState(mockPartitions[0].id);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [expired, setExpired] = useState(false);

  const budgets = mockPartitions.filter((p) => !p.isBackup);
  const amountWei = amount ? ethToWei(parseFloat(amount) || 0) : "0";

  async function generate() {
    setBusy(true);
    setExpired(false);
    const i = await mockWallet.createPaymentIntent({
      partitionId: budgetId,
      amountWei,
      invoiceRef: `INV-${Date.now()}`,
    });
    setIntent(i);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link href="/payments" className="text-sm text-muted underline underline-offset-4">
          ← Payments
        </Link>
        <h1 className="mt-2 text-5xl font-extrabold tracking-tight">
          Request Payment QR
        </h1>
        <p className="mt-2 text-sm text-muted">
          Generates a one-time QR. Whoever scans it before it expires can claim
          this exact amount — share it only with the person you&apos;re paying.
        </p>
      </div>

      {!intent || expired ? (
        <div className="space-y-5 border-2 border-line bg-surface p-6 shadow-hard">
          {expired && (
            <p className="border-2 border-danger bg-danger/10 px-4 py-2 text-sm font-semibold text-danger">
              QR expired. Generate a new one.
            </p>
          )}
          <div>
            <label htmlFor="req-budget" className="text-sm font-medium">From budget</label>
            <select
              id="req-budget"
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
            <label htmlFor="req-amount" className="text-sm font-medium">Amount (ETH)</label>
            <input
              id="req-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full border-2 border-line bg-bg px-3 py-2 font-mono text-lg outline-none focus:border-accent"
              placeholder="0.00"
            />
          </div>
          <Button
            variant="primary"
            className="w-full"
            disabled={!amount || parseFloat(amount) <= 0 || busy}
            onClick={generate}
          >
            {busy ? "Generating…" : "Generate QR"}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="border-2 border-line bg-surface p-8 text-center shadow-hard-lg">
            <div className="mx-auto inline-block border-2 border-line bg-white p-4">
              <QRCodeSVG
                value={JSON.stringify(intent)}
                size={220}
                level="M"
                title={`Payment request QR for ${fmt(intent.amountWei)}`}
              />
            </div>
            <p className="mt-4 text-3xl font-extrabold tabular-nums">{fmt(intent.amountWei)}</p>
            <div className="mt-2">
              <Countdown until={intent.expiresAt} onExpire={() => setExpired(true)} />
            </div>
            <p className="mt-2 text-sm text-muted">
              Scan to claim. Expires automatically — one use only.
            </p>
            <Button className="mt-5" onClick={() => setIntent(null)}>
              Cancel Request
            </Button>
          </div>
          <ViewInfrastructure
            rows={[
              { label: "Intent nonce", value: intent.nonce },
              { label: "Invoice ref", value: intent.invoiceRef },
              { label: "Expires", value: intent.expiresAt },
              { label: "Execution", value: "withdraw() UserOp via session key on claim" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
