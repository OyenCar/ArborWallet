import { NextResponse } from "next/server";
import { MagicApiError, MagicWalletAdapter } from "@/lib/adapters/magic/magic-wallet-adapter";

// POST /api/wallet/create
// Creates a wallet via Magic Server Wallet TEE, delegating to MagicWalletAdapter.
// Expects a Firebase ID Token in the Authorization header.
export async function POST(req: Request) {
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
    const record = await adapter.provision(
      { uid: "", email: null, idToken },
      "evm",
    );
    return NextResponse.json({
      public_address: record.address,
      wallet_type: "eoa",
    });
  } catch (err) {
    console.error("[wallet/create] Error:", err);
    if (err instanceof MagicApiError) {
      return NextResponse.json(
        { error: "Wallet creation failed", detail: err.detail },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
