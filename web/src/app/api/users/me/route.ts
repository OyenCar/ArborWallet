import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/users/me
 * 
 * Get current authenticated user info
 * 
 * Headers: Authorization: Bearer <magic_token>
 * Returns: { id, socialId, address, magicIssuer, createdAt }
 */
export async function GET(request: NextRequest) {
  try {
    const [auth, errorResponse] = await requireAuth(request);

    if (errorResponse) {
      return errorResponse;
    }

    const user = await db.user.findUnique({
      where: { id: auth!.userId },
      include: { address: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: user.id.toString(),
      socialId: user.socialId,
      address: user.address?.address,
      magicIssuer: user.magicIssuer,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[Users/Me]", error);
    return NextResponse.json(
      { error: "Failed to get user" },
      { status: 500 }
    );
  }
}
