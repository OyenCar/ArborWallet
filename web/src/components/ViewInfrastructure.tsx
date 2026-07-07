"use client";

import { useState } from "react";

export interface InfraRow {
  label: string;
  value: string;
}

// Judge-facing panel: the only place blockchain internals surface.
// Designed as first-class UI, not a debug dump (see web/DESIGN.md).
export function ViewInfrastructure({ rows }: { rows: InfraRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-2 border-line bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
      >
        View Infrastructure
        <span className="font-mono text-muted">{open ? "[-]" : "[+]"}</span>
      </button>
      {open && (
        <dl className="border-t-2 border-line">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-4 border-b border-line/20 px-4 py-2 last:border-b-0"
            >
              <dt className="shrink-0 text-xs uppercase tracking-wide text-muted">
                {r.label}
              </dt>
              <dd className="break-all text-right font-mono text-xs">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
