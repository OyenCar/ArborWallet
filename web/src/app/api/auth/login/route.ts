import { NextRequest, NextResponse } from "next/server";
import { Magic } from "@magic-sdk/admin";
import { db } from "@/lib/db";

const magic = new Magic(process.env.MAGIC_SECRET_KEY!);

/**
 * POST /api/auth/login
 * 
 * Frontend sends Magic token, backend verifies and creates session
 * 
 * Body: { token: string }
 * Returns: { userId: bigint, magicIssuer: string, requiresSocialLink: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token required" },
        { status: 400 }
      );
    }

    // Verify token with Magic
    await magic.token.validate(token);

    // Get issuer from token
    const metadata = await magic.users.getMetadataByToken(token);
    const issuer = metadata?.issuer;
    if (!issuer) {
      return NextResponse.json(
        { error: "Could not verify issuer" },
        { status: 401 }
      );
    }

    // Get or create user
    let user = await db.user.findUnique({
      where: { magicIssuer: issuer },
    });

    let requiresSocialLink = false;

    if (!user) {
      user = await db.user.create({
        data: { magicIssuer: issuer },
      });
      requiresSocialLink = true;
    } else if (!user.socialId) {
      requiresSocialLink = true;
    }

    return NextResponse.json({
      userId: user.id.toString(), // Convert bigint to string for JSON
      magicIssuer: user.magicIssuer,
      socialId: user.socialId,
      requiresSocialLink,
    });
  } catch (error) {
    console.error("[Auth/Login]", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
