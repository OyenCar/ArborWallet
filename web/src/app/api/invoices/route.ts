import { NextResponse } from "next/server";

// POST /api/invoices — multipart file upload.
// Mock: returns fake CID + hash. Phase 3: pin to Pinata, hash = keccak256(CID),
// store row in invoices table; hash feeds withdraw(invoiceCidHash).
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'multipart form with "file" field required' },
      { status: 400 },
    );
  }
  const fakeCid = `Qm${Buffer.from(`${file.name}${Date.now()}`)
    .toString("base64url")
    .slice(0, 44)}`;
  const fakeHash = `0x${Array.from({ length: 64 }, () =>
    "0123456789abcdef".charAt(Math.floor(Math.random() * 16)),
  ).join("")}`;

  return NextResponse.json(
    {
      cid: fakeCid,
      cidHash: fakeHash,
      fileName: file.name,
      size: file.size,
      pinned: true,
      provider: "pinata-mock",
    },
    { status: 201 },
  );
}
