"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCurrency } from "@/lib/currency";
import { mockPartitions, mockTxs } from "@/lib/mock/data";
import { formatDate, truncAddr } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { ViewInfrastructure } from "@/components/ViewInfrastructure";

export default function BudgetDetail() {
  const { id } = useParams<{ id: string }>();
  const { fmt } = useCurrency();
  const p = mockPartitions.find((x) => x.id === id);
  if (!p) notFound();

  const txs = mockTxs.filter((t) => t.partitionId === p.id);

  return (
    <div className="space-y-10">
      <div>
        <Link href="/budgets" className="text-sm text-muted underline underline-offset-4">
          ← Budgets
        </Link>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight">{p.label}</h1>
            <p className="mt-3 text-3xl font-bold text-accent-text">
              {fmt(p.balanceWei)}{" "}
              <span className="text-base font-medium text-muted">remaining</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/payments/withdraw">
              <Button variant="primary">Withdraw</Button>
            </Link>
            <Button>Add Member</Button>
          </div>
        </div>
        {p.dueDate && (
          <p className="mt-3 border-2 border-line bg-surface px-4 py-2 text-sm shadow-hard-sm inline-block">
            Auto-releases {formatDate(p.dueDate)} to {p.members.length} people —
            no action needed.
          </p>
        )}
      </div>

      {/* Members */}
      <section>
        <h2 className="mb-4 text-3xl font-bold">Members</h2>
        {p.members.length === 0 ? (
          <p className="text-muted">
            No members yet. This is a reserve budget — add members to activate
            spending.
          </p>
        ) : (
          <div className="border-2 border-line bg-surface shadow-hard">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Spending Limit</th>
                  <th className="px-4 py-3">Spent</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {p.members.map((m) => {
                  const over =
                    BigInt(m.spentWei) * 100n >= BigInt(m.limitWei) * 90n;
                  return (
                    <tr key={m.socialId} className="border-b border-line/20 last:border-b-0">
                      <td className="px-4 py-3">
                        <span className="font-medium">{m.socialId}</span>{" "}
                        <span className="font-mono text-xs text-muted">
                          {truncAddr(m.address)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{fmt(m.limitWei)}</td>
                      <td className={`px-4 py-3 ${over ? "font-bold text-warning-text" : ""}`}>
                        {fmt(m.spentWei)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status="granted" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent payments */}
      <section>
        <h2 className="mb-4 text-3xl font-bold">Recent Payments</h2>
        {txs.length === 0 ? (
          <p className="text-muted">No payments from this budget yet.</p>
        ) : (
          <div className="border-2 border-line bg-surface shadow-hard">
            {txs.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border-b border-line/20 px-4 py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{t.socialId}</span> · {formatDate(t.timestamp)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{fmt(t.amountWei)}</span>
                  <StatusChip status={t.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ViewInfrastructure
        rows={[
          { label: "Partition ID (on-chain)", value: String(p.onChainId) },
          { label: "Vault contract", value: "0xVault… (deploys in Phase 2)" },
          { label: "Network", value: "Arbitrum Sepolia (421614)" },
          { label: "Auto-release", value: p.dueDate ? `Gelato Web3 Function → releaseVault(${p.onChainId})` : "none" },
        ]}
      />
    </div>
  );
}
