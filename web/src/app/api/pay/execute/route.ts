import { NextResponse } from "next/server";
import { mockPartitions } from "@/lib/mock/data";

// POST /api/pay/execute — QR payout execution (both scan-to-pay and
// request-to-claim funnel here).
// Mock validates shape + limit; Phase 3 adds: intent signature check, nonce
// unspent check, then builds withdraw() UserOp via employee session key.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { partitionId, to, amountWei, invoiceCidHash } = body ?? {};

  if (!partitionId || !to || !amountWei || !invoiceCidHash) {
    return NextResponse.json(
      { error: "partitionId, to, amountWei, invoiceCidHash required" },
      { status: 400 },
    );
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
    return NextResponse.json(
      { error: "to must be a valid address" },
      { status: 400 },
    );
  }
  const partition = mockPartitions.find((p) => p.id === partitionId);
  if (!partition) {
    return NextResponse.json({ error: "Partition not found" }, { status: 404 });
  }
  if (BigInt(amountWei) > BigInt(partition.balanceWei)) {
    return NextResponse.json(
      { error: "This budget doesn't have that much" },
      { status: 422 },
    );
  }

  const fake = () =>
    `0x${Array.from({ length: 64 }, () =>
      "0123456789abcdef".charAt(Math.floor(Math.random() * 16)),
    ).join("")}`;

  return NextResponse.json({
    userOpHash: fake(),
    txHash: fake(),
    sponsored: true,
    network: "arbitrum-sepolia",
  });
}
