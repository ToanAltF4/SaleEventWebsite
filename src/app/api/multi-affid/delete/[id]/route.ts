import { NextRequest, NextResponse } from "next/server";
import { getMultiAffid, deleteMultiAffid } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const affidId = parseInt(id);
  const affid = await getMultiAffid(affidId);
  if (!affid) {
    return NextResponse.json({ error: "Khong tim thay Affiliate ID" }, { status: 404 });
  }

  await deleteMultiAffid(affidId);
  return NextResponse.json({ success: true });
}
