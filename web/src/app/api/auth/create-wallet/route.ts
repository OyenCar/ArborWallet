import { NextRequest, NextResponse } from "next/server";
import { verifyMagicTokenNoSocial } from "@/lib/auth";
import { db } from "@/lib/db";

const MAGIC_WALLET_URL = "https://tee.express.magiclabs.com/v1/wallet";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyMagicTokenNoSocial(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (auth.socialId) {
      return NextResponse.json(
        { error: "Social ID already linked" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { socialId } = body;

    if (!socialId) {
      return NextResponse.json(
        { error: "socialId required" },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({
      where: { socialId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Social ID already taken" },
        { status: 409 }
      );
    }

    const providerId = process.env.MAGIC_PROVIDER_ID;
    const secretKey = process.env.MAGIC_SECRET_KEY;

    // Magic's wallet creation endpoint needs a valid server-side secret key,
    // but when you create a wallet for a social login flow, the provider ID is
    // also required so Magic knows which OIDC/social identity provider to use.
    if (!providerId || !secretKey) {
      return NextResponse.json(
        {
          error:
            "Missing MAGIC_PROVIDER_ID or MAGIC_SECRET_KEY in server environment",
        },
        { status: 500 }
      );
    }

    const response = await fetch(MAGIC_WALLET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Magic-Secret-Key": secretKey,
        "X-OIDC-Provider-ID": providerId,
        "X-Magic-Chain": "ETH",
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok || !data.public_address) {
      console.error("[Auth/CreateWallet] Magic wallet response", response.status, data);
      return NextResponse.json(
        { error: "Failed to create wallet" },
        { status: 502 }
      );
    }

    const address = data.public_address as string;

    await db.address.upsert({
      where: { socialId },
      update: { address },
      create: { socialId, address },
    });

    const updatedUser = await db.user.update({
      where: { id: auth.userId },
      data: { socialId },
    });

    return NextResponse.json({
      userId: updatedUser.id.toString(),
      socialId: updatedUser.socialId,
      address,
    });
  } catch (error) {
    console.error("[Auth/CreateWallet]", error);
    return NextResponse.json(
      { error: "Failed to create wallet" },
      { status: 500 }
    );
  }
}
