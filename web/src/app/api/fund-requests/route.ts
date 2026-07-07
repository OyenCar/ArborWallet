import { NextResponse } from "next/server";
import { mockFundRequests } from "@/lib/mock/data";
import type { FundRequest } from "@/lib/types";

// In-memory store on top of fixtures — resets on server restart (mock phase).
const requests: FundRequest[] = [...mockFundRequests];

// GET /api/fund-requests?status=pending
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const rows = status
    ? requests.filter((r) => r.status === status)
    : requests;
  return NextResponse.json({ fundRequests: rows });
}

// POST /api/fund-requests — employee asks for a limit increase.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.partitionId || !body?.socialId || !body?.amountWei) {
    return NextResponse.json(
      { error: "partitionId, socialId, amountWei required" },
      { status: 400 },
    );
  }
  const created: FundRequest = {
    id: `fr${Date.now()}`,
    partitionId: body.partitionId,
    socialId: body.socialId,
    amountWei: String(body.amountWei),
    reason: body.reason ?? "",
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  requests.push(created);
  return NextResponse.json(created, { status: 201 });
}
