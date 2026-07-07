"use client";

import { Fragment, useState } from "react";
import { useCurrency } from "@/lib/currency";
import { mockPartitions, mockTxs } from "@/lib/mock/data";
import { formatDate } from "@/lib/format";
import { StatusChip } from "@/components/ui/StatusChip";

const typeLabels: Record<string, string> = {
  withdraw: "Withdrawal",
  deposit: "Deposit",
  release: "Payroll",
  qr_pay: "Vendor Payment",
};

export default function Activity() {
  const { fmt } = useCurrency();
  const [partition, setPartition] = useState("all");
  const [type, setType] = useState("all");
  const [openRow, setOpenRow] = useState<string | null>(null);

  const rows = mockTxs.filter(
    (t) =>
      (partition === "all" || t.partitionId === partition) &&
      (type === "all" || t.type === type),
  );

  return (
    <div className="space-y-8">
      <h1 className="text-5xl font-extrabold tracking-tight">Activity</h1>

      <div className="flex flex-wrap gap-3">
        <select
          value={partition}
          onChange={(e) => setPartition(e.target.value)}
          aria-label="Filter by budget"
          className="min-h-11 border-2 border-line bg-surface px-3 py-2 text-base shadow-hard-sm outline-none"
        >
          <option value="all">All budgets</option>
          {mockPartitions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filter by payment type"
          className="min-h-11 border-2 border-line bg-surface px-3 py-2 text-base shadow-hard-sm outline-none"
        >
          <option value="all">All types</option>
          {Object.entries(typeLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="border-2 border-line bg-surface shadow-hard">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Budget</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <Fragment key={t.id}>
                <tr
                  onClick={() => setOpenRow(openRow === t.id ? null : t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenRow(openRow === t.id ? null : t.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={openRow === t.id}
                  aria-label={`${t.description}, click for technical details`}
                  className="cursor-pointer border-b border-line/20 last:border-b-0 hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-line"
                >
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.timestamp)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.socialId}</td>
                  <td className="px-4 py-3">{t.partitionLabel}</td>
                  <td className="px-4 py-3">{t.description}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap">
                    {fmt(t.amountWei)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={t.status} />
                  </td>
                </tr>
                {openRow === t.id && (
                  <tr className="border-b border-line/20 bg-bg">
                    <td colSpan={6} className="px-4 py-3">
                      <dl className="grid grid-cols-1 gap-2 font-mono text-xs md:grid-cols-3">
                        <div>
                          <dt className="uppercase text-muted">Transaction hash</dt>
                          <dd className="break-all">{t.txHash}</dd>
                        </div>
                        <div>
                          <dt className="uppercase text-muted">Network</dt>
                          <dd>Arbitrum Sepolia (421614)</dd>
                        </div>
                        <div>
                          <dt className="uppercase text-muted">Invoice (IPFS)</dt>
                          <dd className="break-all">{t.invoiceCid ?? "—"}</dd>
                        </div>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Nothing matches those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Click a row for technical details (transaction hash, network, invoice).
      </p>
    </div>
  );
}
