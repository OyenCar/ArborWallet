import { NextResponse } from "next/server";
import { mockAutomations, mockPartitions } from "@/lib/mock/data";
import type { AutomationRule } from "@/lib/types";

// GET /api/automations — all rules.
// POST /api/automations — create rule.
// Phase 2/3: each kind maps to on-chain execution —
//   scheduled_release → Gelato calls releaseVault(partitionId)
//   low_balance_topup → Gelato condition on balance, calls topUp(from, to, amount)
//   recurring_payment → Gelato time-based, withdraw() via owner-scoped session key
//   limit_reset       → Gelato time-based, calls resetSpent(partitionId)
export async function GET() {
  return NextResponse.json({ automations: mockAutomations });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const kinds = [
    "scheduled_release",
    "low_balance_topup",
    "recurring_payment",
    "limit_reset",
  ];
  if (!body?.partitionId || !kinds.includes(body?.kind)) {
    return NextResponse.json(
      { error: `partitionId and kind (${kinds.join(" | ")}) required` },
      { status: 400 },
    );
  }
  if (!mockPartitions.some((p) => p.id === body.partitionId)) {
    return NextResponse.json({ error: "Partition not found" }, { status: 404 });
  }
  const rule: AutomationRule = {
    id: `a${Date.now()}`,
    partitionId: body.partitionId,
    kind: body.kind,
    enabled: true,
    config: body.config ?? {},
    nextRunAt: body.nextRunAt ?? null,
    lastRunAt: null,
  };
  mockAutomations.push(rule);
  return NextResponse.json(rule, { status: 201 });
}
