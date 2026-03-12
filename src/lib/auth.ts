import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export interface SessionData {
  user?: string;
}

const sessionOptions = {
  password: process.env.SECRET_KEY || "default-fallback-key-must-be-32-chars!",
  cookieName: "kimngan-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getSessionFromRequest(req: NextRequest): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAuth(): Promise<string | null> {
  const session = await getSession();
  return session.user || null;
}
