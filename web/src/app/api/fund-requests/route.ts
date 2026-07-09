import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { v4 as uuid } from "uuid";

/**
 * GET /api/fund-requests?status=pending
 * 
 * Get fund requests with optional status filter
 * Headers: Authorization: Bearer <magic_token>
 */
export async function GET(request: NextRequest) {
  try {
    const [auth, errorResponse] = await requireAuth(request);

    if (errorResponse) {
      return errorResponse;
    }

    const status = new URL(request.url).searchParams.get("status");

    const where = status ? { status: status as "pending" | "approved" | "rejected" } : {};

    const fundRequests = await db.fundRequest.findMany({
      where,
      include: { user: true },
      orderBy: { requestedAt: "desc" },
    });

    const formatted = fundRequests.map((fr) => ({
      id: fr.id,
      partitionId: fr.partitionId.toString(),
      socialId: fr.user.socialId,
      amountWei: fr.amountWei.toString(),
      reason: fr.reason,
      status: fr.status,
      requestedAt: fr.requestedAt.toISOString(),
    }));

    return NextResponse.json({ fundRequests: formatted });
  } catch (error) {
    console.error("[FundRequests/Get]", error);
    return NextResponse.json(
      { error: "Failed to get fund requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fund-requests
 * 
 * Create a new fund request
 * Headers: Authorization: Bearer <magic_token>
 * Body: { partitionId: string, amountWei: string, reason: string }
 */
export async function POST(request: NextRequest) {
  try {
    const [auth, errorResponse] = await requireAuth(request);

    if (errorResponse) {
      return errorResponse;
    }

    const body = await request.json();
    const { partitionId, amountWei, reason } = body;

    if (!partitionId || !amountWei) {
      return NextResponse.json(
        { error: "partitionId and amountWei required" },
        { status: 400 }
      );
    }

    const fundRequest = await db.fundRequest.create({
      data: {
        id: uuid(),
        partitionId: BigInt(partitionId),
        userId: auth!.userId,
        amountWei: amountWei.toString(),
        reason: reason || "",
        status: "pending",
      },
      include: { user: true },
    });

    return NextResponse.json(
      {
        id: fundRequest.id,
        partitionId: fundRequest.partitionId.toString(),
        socialId: fundRequest.user.socialId,
        amountWei: fundRequest.amountWei.toString(),
        reason: fundRequest.reason,
        status: fundRequest.status,
        requestedAt: fundRequest.requestedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[FundRequests/Post]", error);
    return NextResponse.json(
      { error: "Failed to create fund request" },
      { status: 500 }
    );
  }
}
