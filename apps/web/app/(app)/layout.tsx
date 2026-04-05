import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/jwt";
import HeaderAndSidebarLayout from "@/components/HeaderAndSidebarLayout";
import type { ReactNode } from "react";

async function getUser(token: string | null) {
  if (!token) return null;
  
  try {
    const payload = verifyJwt<{ sub: string }>(token);
    if (!payload) return null;

    const apiUrl = process.env.API_URL || "http://golf_api:4000";
    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? null;

  if (!token) {
    redirect("/login");
  }

  const user = await getUser(token);

  if (!user) {
    redirect("/login");
  }

  return (
    <HeaderAndSidebarLayout user={{ firstName: user.firstName ?? "", lastName: user.lastName ?? "" }}>
      {children}
    </HeaderAndSidebarLayout>
  );
}
