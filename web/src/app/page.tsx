"use client";

import Link from "next/link";
import { useCurrency } from "@/lib/currency";
import {
  mockFundRequests,
  mockPartitions,
  mockTxs,
  mockVaultTotalWei,
} from "@/lib/mock/data";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";

export default function Dashboard() {
  const { fmt } = useCurrency();
  const pending = mockFundRequests.filter((r) => r.status === "pending");
  const payroll = mockPartitions.find((p) => p.dueDate);

  return (
    <div className="space-y-12">
      {/* Hero — one dominant number */}
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-muted">
          Company Treasury
        </p>
        <h1 className="mt-2 text-6xl font-extrabold tracking-tight tabular-nums md:text-7xl">
          {fmt(mockVaultTotalWei)}
        </h1>
        <div className="mt-6 flex gap-3">
          <Button variant="primary">Create Budget</Button>
          <Button>Transfer Funds</Button>
        </div>
      </section>

      {/* Budgets */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-3xl font-bold">Budgets</h2>
          <Link href="/budgets" className="text-sm text-accent-text underline underline-offset-4">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mockPartitions.map((p) => (
            <Link
              key={p.id}
              href={`/budgets/${p.id}`}
              className="border-2 border-line bg-surface p-5 shadow-hard transition-shift hover:shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              <p className="text-sm font-medium text-muted">{p.label}</p>
              <p className="mt-1 text-2xl font-bold">{fmt(p.balanceWei)}</p>
              <p className="mt-2 text-xs text-muted">
                {p.isBackup
                  ? "Reserve — no members yet"
                  : `${p.members.length} member${p.members.length === 1 ? "" : "s"}`}
                {p.dueDate && " · auto-release scheduled"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Pending approvals */}
        <section>
          <h2 className="mb-4 text-3xl font-bold">Pending Approvals</h2>
          {pending.length === 0 ? (
            <p className="text-muted">Nothing waiting on you.</p>
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="border-2 border-line bg-surface p-4 shadow-hard"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{r.socialId}</span>
                    <span className="font-bold">{fmt(r.amountWei)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.reason}</p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="primary" className="px-3 py-1.5 text-xs">
                      Approve
                    </Button>
                    <Button className="px-3 py-1.5 text-xs">Reject</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upcoming payroll */}
        <section>
          <h2 className="mb-4 text-3xl font-bold">Upcoming Payroll</h2>
          {payroll?.dueDate ? (
            <div className="border-2 border-line bg-surface p-5 shadow-hard">
              <div className="flex items-center justify-between">
                <p className="font-medium">{payroll.label}</p>
                <StatusChip status="pending" />
              </div>
              <p className="mt-2 text-2xl font-bold">{fmt(payroll.balanceWei)}</p>
              <p className="mt-1 text-sm text-muted">
                Releases automatically on {formatDate(payroll.dueDate)} to{" "}
                {payroll.members.length} people. No action needed.
              </p>
            </div>
          ) : (
            <p className="text-muted">No scheduled releases.</p>
          )}
        </section>
      </div>

      {/* Recent activity */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-3xl font-bold">Recent Activity</h2>
          <Link href="/activity" className="text-sm text-accent-text underline underline-offset-4">
            Full report
          </Link>
        </div>
        <div className="border-2 border-line bg-surface shadow-hard">
          {mockTxs.slice(0, 4).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border-b border-line/20 px-4 py-3 last:border-b-0"
            >
              <div>
                <p className="text-sm font-medium">{t.description}</p>
                <p className="text-xs text-muted">
                  {t.partitionLabel} · <span className="font-mono">{t.socialId}</span> ·{" "}
                  {formatDate(t.timestamp)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">{fmt(t.amountWei)}</span>
                <StatusChip status={t.status} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
