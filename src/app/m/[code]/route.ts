import { NextRequest, NextResponse } from "next/server";
import { getMultiAffidLink, incrementMultiAffidClick } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await getMultiAffidLink(code);

  if (!link) {
    return new NextResponse("Link khong ton tai", { status: 404 });
  }

  await incrementMultiAffidClick(code);
  return NextResponse.redirect(link.target_url, 302);
}
