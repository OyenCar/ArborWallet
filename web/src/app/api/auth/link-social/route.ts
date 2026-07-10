import { NextRequest, NextResponse } from "next/server";
import { verifyMagicTokenNoSocial } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/auth/link-social
 * 
 * Links a social_id to an authenticated user's account
 * This is NON-RENAMEABLE once set (enforced by DB constraint)
 * 
 * Headers: Authorization: Bearer <magic_token>
 * Body: { socialId: string, address: string }
 * Returns: { userId: bigint, socialId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyMagicTokenNoSocial(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { socialId, address } = await request.json();

    if (!socialId || !address) {
      return NextResponse.json(
        { error: "socialId and address required" },
        { status: 400 }
      );
    }

    // Check if user already has a socialId linked
    const user = await db.user.findUnique({
      where: { id: auth.userId },
    });

    if (user?.socialId) {
      return NextResponse.json(
        {
          error: "Social ID already linked (non-renameable)",
          currentSocialId: user.socialId,
        },
        { status: 400 }
      );
    }

    // Ensure address record exists
    await db.address.upsert({
      where: { socialId },
      update: { address },
      create: { socialId, address },
    });

    // Update user with social_id
    const updatedUser = await db.user.update({
      where: { id: auth.userId },
      data: { socialId },
    });

    return NextResponse.json({
      userId: updatedUser.id.toString(),
      socialId: updatedUser.socialId,
      message: "Social ID linked successfully (non-renameable)",
    });
  } catch (error) {
    console.error("[Auth/LinkSocial]", error);
    return NextResponse.json(
      { error: "Failed to link social ID" },
      { status: 500 }
    );
  }
}
