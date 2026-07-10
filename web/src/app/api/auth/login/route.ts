import { NextResponse } from "next/server";
import { mockUsers } from "@/lib/mock/data";
import type { User } from "@/lib/types";

// POST /api/auth/login
// Verifies the Magic DID token server-side, then resolves the Social ID ↔
// address mapping (SPEC off-chain flow). Phase 3: persist to the users table.
//
// Without MAGIC_SECRET_KEY set, skips verification and trusts the body — dev/
// demo mode only. Never ship that to prod.
export async function POST(req: Request) {
  const secret = process.env.MAGIC_SECRET_KEY;
  const auth = req.headers.get("authorization");
  const didToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  const body = await req.json().catch(() => null);
  let email: string | undefined = body?.email;
  let address: string | undefined = body?.address;

  if (secret) {
    if (!didToken) {
      return NextResponse.json({ error: "Missing DID token" }, { status: 401 });
    }
    try {
      const { Magic } = await import("@magic-sdk/admin");
      const admin = new Magic(secret);
      admin.token.validate(didToken); // throws if invalid/expired
      const meta = await admin.users.getMetadataByToken(didToken);
      email = meta.email ?? email;
      address = meta.publicAddress ?? address;
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired session token" },
        { status: 401 },
      );
    }
  }

  if (!address) {
    return NextResponse.json({ error: "No address resolved" }, { status: 400 });
  }

  // resolve against the seeded directory; unknown addresses default to employee
  const seeded = mockUsers.find(
    (u) => u.address.toLowerCase() === address!.toLowerCase(),
  );
  // change to db -> nanti
  const user: User = seeded ?? {
    socialId: `@${(email ?? "user").split("@")[0]}`,
    address: address as `0x${string}`,
    role: "employee",
  };

  return NextResponse.json(user);
}
