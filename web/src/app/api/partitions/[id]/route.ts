import { NextResponse } from "next/server";
import { mockPartitions } from "@/lib/mock/data";

// GET /api/partitions/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const partition = mockPartitions.find((p) => p.id === id);
  if (!partition) {
    return NextResponse.json({ error: "Partition not found" }, { status: 404 });
  }
  return NextResponse.json(partition);
}
