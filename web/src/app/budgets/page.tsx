"use client";

import Link from "next/link";
import { mockPartitions } from "@/lib/mock/data";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { AnimatedAmount } from "@/components/ui/AnimatedAmount";

export default function Budgets() {
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
                <p className="text-2xl font-bold">
                  <AnimatedAmount wei={p.balanceWei} />
                </p>
              </div>
              <div className="mt-4">
                <Progress
                  fraction={pct / 100}
                  label={`${pct}% of allocation spent`}
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
