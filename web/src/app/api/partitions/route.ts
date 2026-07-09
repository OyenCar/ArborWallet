import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/partitions
 * 
 * Get all partitions with their members
 * 
 * Headers: Authorization: Bearer <magic_token>
 * Returns: { partitions: [...], vaultTotalWei: string }
 */
export async function GET(request: NextRequest) {
  try {
    const [auth, errorResponse] = await requireAuth(request);

    if (errorResponse) {
      return errorResponse;
    }

    const partitions = await db.partition.findMany({
      include: {
        partitionMembers: {
          include: {
            user: {
              include: { address: true },
            },
          },
        },
      },
    });

    // Format response
    const formattedPartitions = partitions.map((p) => ({
      id: p.id.toString(),
      onChainId: p.onChainId.toString(),
      label: p.label,
      isBackup: p.isBackup,
      dueDate: p.dueDate?.toISOString() ?? null,
      balanceWei: "0", // TODO: Get from on-chain data
      members: p.partitionMembers.map((m) => ({
        socialId: m.user.socialId,
        address: m.user.address?.address,
        limitWei: m.limitWei.toString(),
        spentWei: m.spentWei.toString(),
      })),
    }));

    return NextResponse.json({
      partitions: formattedPartitions,
      vaultTotalWei: "0", // TODO: Calculate from partitions
    });
  } catch (error) {
    console.error("[Partitions]", error);
    return NextResponse.json(
      { error: "Failed to get partitions" },
      { status: 500 }
    );
  }
}
