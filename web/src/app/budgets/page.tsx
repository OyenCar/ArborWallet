"use client";

import Link from "next/link";
import { useCurrency } from "@/lib/currency";
import { mockPartitions } from "@/lib/mock/data";
import { Button } from "@/components/ui/Button";

export default function Budgets() {
  const { fmt } = useCurrency();

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h1 className="text-5xl font-extrabold tracking-tight">Budgets</h1>
        <Button variant="primary">Create Budget</Button>
      </div>

      <div className="space-y-4">
        {mockPartitions.map((p) => {
          const spent = p.members.reduce(
            (acc, m) => acc + BigInt(m.spentWei),
            0n,
          );
          const total = BigInt(p.balanceWei) + spent;
          const pct = total === 0n ? 0 : Number((spent * 100n) / total);

          return (
            <Link
              key={p.id}
              href={`/budgets/${p.id}`}
              className="block border-2 border-line bg-surface p-6 shadow-hard transition-shift hover:shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-bold">{p.label}</h2>
                <p className="text-2xl font-bold">{fmt(p.balanceWei)}</p>
              </div>
              <div className="mt-4 h-3 border-2 border-line bg-bg">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                {p.isBackup
                  ? "Reserve budget — assign members to activate spending"
                  : `${pct}% of allocation spent · ${p.members.length} member${p.members.length === 1 ? "" : "s"}`}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
