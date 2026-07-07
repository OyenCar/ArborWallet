import { NextResponse } from "next/server";
import { mockPartitions } from "@/lib/mock/data";
import type { PaymentIntent } from "@/lib/types";

// Nonce registry — in-memory for mock phase. Phase 3: DB row per intent,
// marked spent inside the same transaction as the payout.
const usedNonces = new Set<string>();

// POST /api/intents — create a request-to-claim payment intent (QR payload).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { partitionId, amountWei, invoiceRef } = body ?? {};
  if (!partitionId || !amountWei) {
    return NextResponse.json(
      { error: "partitionId and amountWei required" },
      { status: 400 },
    );
  }
  if (!mockPartitions.some((p) => p.id === partitionId)) {
    return NextResponse.json({ error: "Partition not found" }, { status: 404 });
  }
  const intent: PaymentIntent = {
    partitionId,
    amountWei: String(amountWei),
    invoiceRef: invoiceRef ?? `INV-${Date.now()}`,
    nonce: `0x${Array.from({ length: 32 }, () =>
      "0123456789abcdef".charAt(Math.floor(Math.random() * 16)),
    ).join("")}`,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  };
  return NextResponse.json(intent, { status: 201 });
}

// PUT /api/intents — claim an intent (payee supplies receiving address).
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const { nonce, expiresAt, to } = body ?? {};
  if (!nonce || !expiresAt || !to) {
    return NextResponse.json(
      { error: "nonce, expiresAt, to required" },
      { status: 400 },
    );
  }
  if (new Date(expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "Intent expired" }, { status: 410 });
  }
  if (usedNonces.has(nonce)) {
    return NextResponse.json({ error: "Intent already claimed" }, { status: 409 });
  }
  usedNonces.add(nonce);
  return NextResponse.json({
    claimed: true,
    txHash: `0x${Array.from({ length: 64 }, () =>
      "0123456789abcdef".charAt(Math.floor(Math.random() * 16)),
    ).join("")}`,
  });
}
