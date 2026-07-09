import { Magic } from "@magic-sdk/admin";
import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";

// Initialize Magic instance on the server
const magic = new Magic(process.env.MAGIC_SECRET_KEY!);

export interface AuthContext {
  userId: bigint;
  socialId: string;
  magicIssuer: string;
  address: string;
}

/**
 * Verify Magic token and get auth context
 * Call this at the start of protected API routes
 */
export async function verifyMagicToken(
  request: NextRequest
): Promise<AuthContext | null> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.slice(7);
    
    // Verify token with Magic
    await magic.token.validate(token);

    // Get issuer (user ID) from token
    const metadata = await magic.users.getMetadataByToken(token);
    const issuer = metadata?.issuer;
    if (!issuer) {
      return null;
    }

    // Get or create user in database
    let user = await db.user.findUnique({
      where: { magicIssuer: issuer },
    });

    if (!user) {
      // Create new user on first login
      user = await db.user.create({
        data: {
          magicIssuer: issuer,
        },
      });
    }

    if (!user.socialId) {
      return null; // Social login not yet completed
    }

    const address = await db.address.findUnique({
      where: { socialId: user.socialId },
    });

    if (!address) {
      return null;
    }

    return {
      userId: user.id,
      socialId: user.socialId,
      magicIssuer: user.magicIssuer,
      address: address.address,
    };
  } catch (error) {
    console.error("[Auth] Token verification failed:", error);
    return null;
  }
}

/**
 * Middleware to check authentication on protected routes
 */
export async function requireAuth(
  request: NextRequest
): Promise<[AuthContext | null, NextResponse | null]> {
  const auth = await verifyMagicToken(request);

  if (!auth) {
    return [
      null,
      NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    ];
  }

  return [auth, null];
}

export async function linkSocialId(
  magicIssuer: string,
  socialId: string,
  address: string
): Promise<{ userId: bigint; socialId: string }> {
  // Ensure address exists or create it
  await db.address.upsert({
    where: { socialId },
    update: { address },
    create: { socialId, address },
  });

  // Update user with social_id (non-renameable after first set)
  const user = await db.user.update({
    where: { magicIssuer },
    data: { socialId },
  });

  return {
    userId: user.id,
    socialId: user.socialId!,
  };
}
