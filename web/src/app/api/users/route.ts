import { NextResponse } from "next/server";
import { mockPartitions, mockUser } from "@/lib/mock/data";
import type { User } from "@/lib/types";

// GET /api/users — Social ID directory (username ↔ address mapping).
// POST /api/users — register after Magic login (socialId + derived address).
export async function GET() {
  const employees: User[] = Array.from(
    new Map(
      mockPartitions
        .flatMap((p) => p.members)
        .map((m) => [
          m.socialId,
          { socialId: m.socialId, address: m.address, role: "employee" as const },
        ]),
    ).values(),
  );
  return NextResponse.json({ users: [mockUser, ...employees] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.socialId || !body?.address) {
    return NextResponse.json(
      { error: "socialId and address required" },
      { status: 400 },
    );
  }
  // Phase 3: verify Magic DID token server-side before trusting the mapping.
  return NextResponse.json(
    { socialId: body.socialId, address: body.address, role: "employee" },
    { status: 201 },
  );
}
