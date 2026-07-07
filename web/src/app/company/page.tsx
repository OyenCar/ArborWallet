"use client";

import { useState } from "react";
import { useCurrency } from "@/lib/currency";
import {
  mockAutomations,
  mockFundRequests,
  mockPartitions,
} from "@/lib/mock/data";
import { formatDate, truncAddr } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { ViewInfrastructure } from "@/components/ViewInfrastructure";
import type { AutomationRule } from "@/lib/types";

const automationMeta: Record<
  AutomationRule["kind"],
  { title: string; describe: (r: AutomationRule, fmt: (w: string) => string, label: (id: string) => string) => string }
> = {
  scheduled_release: {
    title: "Scheduled release",
    describe: (r, _fmt, label) =>
      `Releases the full ${label(r.partitionId)} budget to its members${r.config.releaseAt ? ` on ${formatDate(r.config.releaseAt)}` : ""}. Runs even if no one is online.`,
  },
  low_balance_topup: {
    title: "Low-balance top-up",
    describe: (r, fmt, label) =>
      `When ${label(r.partitionId)} drops below ${fmt(r.config.thresholdWei ?? "0")}, refills ${fmt(r.config.topUpWei ?? "0")} from ${label(r.config.sourcePartitionId ?? "")}.`,
  },
  recurring_payment: {
    title: "Recurring payment",
    describe: (r, fmt) =>
      `Pays ${fmt(r.config.amountWei ?? "0")} to ${r.config.toAddress ? truncAddr(r.config.toAddress) : "vendor"} every ${r.config.intervalDays ?? 30} days from the budget. Invoice logged automatically.`,
  },
  limit_reset: {
    title: "Spending limit reset",
    describe: (r, _fmt, label) =>
      `Resets every member's spent counter in ${label(r.partitionId)} every ${r.config.intervalDays ?? 30} days — fresh budget each cycle.`,
  },
};

export default function Company() {
  const { fmt } = useCurrency();
  const [frozen, setFrozen] = useState(false);
  const [freezeArmed, setFreezeArmed] = useState(false);
  const [rules, setRules] = useState<AutomationRule[]>(mockAutomations);

  const partitionLabel = (id: string) =>
    mockPartitions.find((p) => p.id === id)?.label ?? "budget";

  function toggleRule(id: string) {
    setRules((rs) =>
      rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  }

  function handleFreeze() {
    if (frozen) {
      setFrozen(false);
      return;
    }
    if (!freezeArmed) {
      setFreezeArmed(true);
      setTimeout(() => setFreezeArmed(false), 4000);
      return;
    }
    setFrozen(true);
    setFreezeArmed(false);
  }

  const members = Array.from(
    new Map(
      mockPartitions
        .flatMap((p) => p.members.map((m) => [m.socialId, m] as const)),
    ).values(),
  );

  return (
    <div className="space-y-10">
      <h1 className="text-5xl font-extrabold tracking-tight">Company</h1>

      {frozen && (
        <div className="border-2 border-danger bg-danger/10 px-5 py-4">
          <p className="font-bold text-danger">All spending is frozen.</p>
          <p className="mt-1 text-sm text-danger">
            Every spending permission is suspended until you unfreeze.
          </p>
        </div>
      )}

      {/* Team */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-3xl font-bold">Team</h2>
          <Button variant="primary">Invite Member</Button>
        </div>
        <div className="border-2 border-line bg-surface shadow-hard">
          {members.map((m) => (
            <div
              key={m.socialId}
              className="flex items-center justify-between border-b border-line/20 px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center border-2 border-line bg-bg font-bold">
                  {m.socialId.replace("@", "")[0].toUpperCase()}
                </span>
                <span className="font-mono text-sm">{m.socialId}</span>
              </div>
              <div className="flex items-center gap-3">
                <StatusChip status={frozen ? "revoked" : "granted"} />
                <Button className="px-3 py-1.5 text-xs">Edit Limits</Button>
                <Button
                  variant="danger"
                  className="px-3 py-1.5 text-xs"
                  onClick={() =>
                    window.confirm(
                      `Revoke ${m.socialId}'s spending permission? They lose access immediately. You can re-grant later.`,
                    )
                  }
                >
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fund requests */}
      <section>
        <h2 className="mb-4 text-3xl font-bold">Fund Requests</h2>
        <div className="border-2 border-line bg-surface shadow-hard">
          {mockFundRequests.map((r) => {
            const p = mockPartitions.find((x) => x.id === r.partitionId);
            return (
              <div
                key={r.id}
                className="flex items-center justify-between border-b border-line/20 px-4 py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm">
                    <span className="font-mono">{r.socialId}</span> requests{" "}
                    <span className="font-bold">{fmt(r.amountWei)}</span> more in{" "}
                    <span className="font-medium">{p?.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.reason} · {formatDate(r.requestedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={r.status} />
                  {r.status === "pending" && (
                    <>
                      <Button variant="primary" className="px-3 py-1.5 text-xs">
                        Approve
                      </Button>
                      <Button className="px-3 py-1.5 text-xs">Reject</Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Automation rules */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-3xl font-bold">Automation</h2>
          <Button variant="primary">New Automation</Button>
        </div>
        <div className="space-y-4">
          {rules.map((r) => {
            const meta = automationMeta[r.kind];
            return (
              <div
                key={r.id}
                className={`border-2 border-line bg-surface p-5 shadow-hard ${r.enabled ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold">
                      {partitionLabel(r.partitionId)} — {meta.title}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {meta.describe(r, fmt, partitionLabel)}
                    </p>
                    <p className="mt-2 font-mono text-xs text-muted">
                      {r.nextRunAt
                        ? `Next run: ${formatDate(r.nextRunAt)}`
                        : "Runs when condition is met"}
                      {r.lastRunAt && ` · Last run: ${formatDate(r.lastRunAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusChip status={r.enabled ? "active" : "paused"} />
                    <Button
                      className="px-3 py-1.5 text-xs"
                      onClick={() => toggleRule(r.id)}
                      aria-pressed={r.enabled}
                    >
                      {r.enabled ? "Pause" : "Resume"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Emergency freeze */}
      <section>
        <h2 className="mb-4 text-3xl font-bold">Emergency</h2>
        <div className="border-2 border-danger bg-surface p-5">
          <p className="font-medium">
            Freeze all spending immediately. Every permission is suspended until
            you unfreeze. Use this if an account is compromised.
          </p>
          <Button
            variant={frozen ? "secondary" : "danger"}
            className="mt-4"
            onClick={handleFreeze}
          >
            {frozen
              ? "Unfreeze Spending"
              : freezeArmed
                ? "Click again to confirm freeze"
                : "Freeze All Spending"}
          </Button>
          {freezeArmed && (
            <p className="mt-2 text-sm font-semibold text-danger" role="alert">
              This suspends every spending permission. Click again within 4
              seconds to confirm.
            </p>
          )}
        </div>
      </section>

      <ViewInfrastructure
        rows={[
          { label: "Owner account", value: "ZeroDev Kernel · sudo validator (ECDSA)" },
          { label: "Member permissions", value: "Session keys · CallPolicy: withdraw() only" },
          { label: "Revoke mechanism", value: "Session key invalidation, instant" },
          { label: "Automation", value: "Gelato Web3 Function → releaseVault()" },
        ]}
      />
    </div>
  );
}
