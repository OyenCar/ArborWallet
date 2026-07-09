import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/transactions?partitionId=&type=&socialId=
 * 
 * Get transactions with optional filters
 * Headers: Authorization: Bearer <magic_token>
 */
export async function GET(request: NextRequest) {
  try {
    const [auth, errorResponse] = await requireAuth(request);

    if (errorResponse) {
      return errorResponse;
    }

    const url = new URL(request.url);
    const partitionId = url.searchParams.get("partitionId");
    const type = url.searchParams.get("type");
    const socialId = url.searchParams.get("socialId");

    const where: any = {};
    
    if (partitionId) {
      where.partitionId = BigInt(partitionId);
    }
    if (type) {
      where.type = type;
    }
    if (socialId) {
      const user = await db.user.findUnique({
        where: { socialId },
      });
      if (user) {
        where.userId = user.id;
      } else {
        // No user found, return empty
        return NextResponse.json({ transactions: [], count: 0 });
      }
    }

    const transactions = await db.transaction.findMany({
      where,
      include: {
        user: { include: { address: true } },
        partition: true,
      },
      orderBy: { timestamp: "desc" },
      take: 100, // Limit to prevent huge queries
    });

    const formatted = transactions.map((tx) => ({
      id: tx.id.toString(),
      txHash: `0x${Buffer.from(tx.txHash).toString("hex")}`,
      partitionId: tx.partitionId.toString(),
      partitionLabel: tx.partition.label,
      socialId: tx.user.socialId,
      amountWei: tx.amountWei.toString(),
      type: tx.type,
      status: "paid", // TODO: Get from on-chain status
      description: `Transaction ${tx.id}`, // TODO: Add description field to DB
      timestamp: tx.timestamp.toISOString(),
    }));

    return NextResponse.json({
      transactions: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error("[Transactions]", error);
    return NextResponse.json(
      { error: "Failed to get transactions" },
      { status: 500 }
    );
  }
}
