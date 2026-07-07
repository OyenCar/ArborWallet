import { NextResponse } from "next/server";
import { mockFundRequests } from "@/lib/mock/data";

// PATCH /api/fund-requests/:id  { action: "approve" | "reject" }
// Phase 3: approve path sends requestApproved() on-chain via owner sudo key,
// only flips DB status after tx confirmation.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 },
    );
  }
  const request = mockFundRequests.find((r) => r.id === id);
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json(
      { error: `Request already ${request.status}` },
      { status: 409 },
    );
  }
  request.status = action === "approve" ? "approved" : "rejected";
  return NextResponse.json({
    ...request,
    // mock of the on-chain approval tx the real backend would send
    txHash: action === "approve" ? `0x${"e1".repeat(32)}` : undefined,
  });
}
