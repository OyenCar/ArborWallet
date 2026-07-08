"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { mockTxs } from "@/lib/mock/data";
import { formatDate, truncAddr } from "@/lib/format";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import { AnimatedAmount } from "@/components/ui/AnimatedAmount";
import { fadeIn, slideInRight } from "@/lib/motion";
import type { Partition } from "@/lib/types";

export function BudgetDetailPanel({
  partition,
  onClose,
}: {
  partition: Partition;
  onClose: () => void;
}) {
  const { fmt } = useCurrency();
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLButtonElement>(null);
  const flows = mockTxs
    .filter((t) => t.partitionId === partition.id)
    .slice(0, 6);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // slide in from trigger side; backdrop fades (modal-motion)
  useEffect(() => {
    if (panel.current) slideInRight(panel.current);
    if (backdrop.current) fadeIn(backdrop.current);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        ref={backdrop}
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50"
      />
      <div
        ref={panel}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l-2 border-line bg-surface shadow-hard-lg"
      >
        <div className="flex items-start justify-between border-b-2 border-line p-5">
          <div>
            <p className="text-sm text-muted">{partition.label}</p>
            <p className="mt-1 text-3xl font-bold">
              <AnimatedAmount wei={partition.balanceWei} />
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 min-w-11 border-2 border-line text-lg font-bold"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5">
          <section>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
              Whitelisted members
            </h3>
            {partition.members.length === 0 ? (
              <p className="text-sm text-muted">
                No members — reserve budget.
              </p>
            ) : (
              <div className="space-y-2">
                {partition.members.map((m) => (
                  <div
                    key={m.socialId}
                    className="border-2 border-line p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{m.socialId}</span>
                      <span className="font-mono text-xs text-muted">
                        {truncAddr(m.address)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted">
                      <span>Limit {fmt(m.limitWei)}</span>
                      <span>Spent {fmt(m.spentWei)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
              In / out flows
            </h3>
            {flows.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {flows.map((t) => {
                  const isIn = t.type === "deposit";
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between border-b border-line/20 py-2 text-sm last:border-b-0"
                    >
                      <div>
                        <p>{t.description}</p>
                        <p className="text-xs text-muted">
                          {formatDate(t.timestamp)}
                        </p>
                      </div>
                      <span
                        className={`font-bold tabular-nums ${isIn ? "text-success-text" : ""}`}
                      >
                        {isIn ? "+" : "−"}
                        {fmt(t.amountWei)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="border-t-2 border-line p-5">
          <Link href={`/budgets/${partition.id}`}>
            <Button variant="primary" className="w-full">
              Open full page
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
