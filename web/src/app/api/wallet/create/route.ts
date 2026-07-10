import { NextResponse } from "next/server";

// POST /api/wallet/create
// Creates an Ethereum wallet via Magic Server Wallet TEE.
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
  const firebaseToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!firebaseToken) {
    return NextResponse.json(
      { error: "Missing Firebase ID token" },
      { status: 401 },
    );
  }

  try {
    const res = await fetch("https://tee.express.magiclabs.com/v1/wallet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firebaseToken}`,
        "X-Magic-Secret-Key": secretKey,
        "X-OIDC-Provider-ID": oidcProviderId,
        "X-Magic-Chain": "ETH",
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[wallet/create] Magic TEE error:", res.status, body);
      return NextResponse.json(
        { error: "Wallet creation failed", detail: body },
        { status: res.status },
      );
    }

    const data = await res.json();
    // data should contain { public_address, wallet_type }
    return NextResponse.json({
      public_address: data.public_address,
      wallet_type: data.wallet_type,
    });
  } catch (err) {
    console.error("[wallet/create] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
