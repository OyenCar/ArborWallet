import { NextResponse } from "next/server";
import { mockTxs } from "@/lib/mock/data";

// GET /api/transactions?partitionId=&type=&socialId=
// Transaction report source (SPEC feature 5) — grouping/filtering server-side.
// Phase 3: SELECT ... FROM transactions WHERE ... (indexed from Vault events).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const partitionId = url.searchParams.get("partitionId");
  const type = url.searchParams.get("type");
  const socialId = url.searchParams.get("socialId");

  let rows = mockTxs;
  if (partitionId) rows = rows.filter((t) => t.partitionId === partitionId);
  if (type) rows = rows.filter((t) => t.type === type);
  if (socialId) rows = rows.filter((t) => t.socialId === socialId);

  return NextResponse.json({ transactions: rows, count: rows.length });
}
