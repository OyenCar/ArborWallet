import { NextResponse } from "next/server";

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
  const firebaseToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!firebaseToken) {
    return NextResponse.json(
      { error: "Missing Firebase ID token" },
      { status: 401 },
    );
  }

  try {
    const res = await fetch("https://tee.express.magiclabs.com/v1/wallet", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${firebaseToken}`,
        "X-Magic-Secret-Key": secretKey,
        "X-OIDC-Provider-ID": oidcProviderId,
        "X-Magic-Chain": "ETH",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[wallet/address] Magic TEE error:", res.status, body);
      return NextResponse.json(
        { error: "Wallet lookup failed", detail: body },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({
      public_address: data.public_address,
      wallet_type: data.wallet_type,
    });
  } catch (err) {
    console.error("[wallet/address] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
