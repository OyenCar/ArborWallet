import { NextResponse } from "next/server";
import { MOCK_ETH_USD } from "@/lib/mock/data";

// GET /api/price — display-only conversion rate for the fiat/ETH toggle.
// Phase 3: proxy CoinGecko with short server-side cache (30-60s).
export async function GET() {
  return NextResponse.json({
    ethUsd: MOCK_ETH_USD,
    source: "mock",
    fetchedAt: new Date().toISOString(),
  });
}
