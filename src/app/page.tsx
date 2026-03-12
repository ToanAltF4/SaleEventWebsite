import { getSession } from "@/lib/auth";
import HomeClient from "./HomeClient";

export const metadata = { title: "San Sale Cung Kim Ngan - Trang chu" };

export default async function HomePage() {
  const session = await getSession();
  const user = session.user || null;
  return <HomeClient user={user} />;
}
