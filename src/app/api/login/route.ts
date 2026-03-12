import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Vui long nhap tai khoan va mat khau" }, { status: 400 });
  }

  const valid = await verifyUser(username.trim(), password);
  if (!valid) {
    return NextResponse.json({ error: "Sai tai khoan hoac mat khau" }, { status: 401 });
  }

  const session = await getSession();
  session.user = username.trim();
  await session.save();

  return NextResponse.json({ success: true });
}
