import { NextResponse } from "next/server";
import { mockPartitions, mockVaultTotalWei } from "@/lib/mock/data";

// GET /api/partitions — all partitions + vault total.
// Phase 3: replace mock with Postgres query + on-chain balance read.
export async function GET() {
  return NextResponse.json({
    vaultTotalWei: mockVaultTotalWei,
    partitions: mockPartitions,
  });
}
