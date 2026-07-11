import { NextResponse } from "next/server";
import { MagicApiError, MagicWalletAdapter } from "@/lib/adapters/magic/magic-wallet-adapter";

// GET /api/wallet/address
// Retrieves the existing wallet address for a user from Magic Server Wallet TEE.
// Expects a Firebase ID Token in the Authorization header.
export async function GET(req: Request) {
  const secretKey = process.env.MAGIC_SECRET_KEY;
  const oidcProviderId = process.env.OIDC_PROVIDER_ID;

  if (!secretKey || !oidcProviderId) {
    return NextResponse.json(
      { error: "Server misconfiguration (missing keys)" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!idToken) {
    return NextResponse.json(
      { error: "Missing Firebase ID token" },
      { status: 401 },
    );
  }

  try {
    const adapter = new MagicWalletAdapter({ secretKey, oidcProviderId });
    const address = await adapter.getAddress(
      { uid: "", email: null, idToken },
      "evm",
    );
    return NextResponse.json({
      public_address: address,
      wallet_type: "eoa",
    });
  } catch (err) {
    console.error("[wallet/address] Error:", err);
    if (err instanceof MagicApiError) {
      return NextResponse.json(
        { error: "Wallet lookup failed", detail: err.detail },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
