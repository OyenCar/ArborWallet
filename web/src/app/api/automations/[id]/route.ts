import { NextResponse } from "next/server";
import { mockAutomations } from "@/lib/mock/data";

// PATCH /api/automations/:id  { enabled: boolean }
// Phase 3: enabling registers/unregisters the matching Gelato task.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled (boolean) required" },
      { status: 400 },
    );
  }
  const rule = mockAutomations.find((a) => a.id === id);
  if (!rule) {
    return NextResponse.json({ error: "Automation not found" }, { status: 404 });
  }
  rule.enabled = body.enabled;
  return NextResponse.json(rule);
}
