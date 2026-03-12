import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.user) redirect("/login");

  return <AdminShell user={session.user}>{children}</AdminShell>;
}
