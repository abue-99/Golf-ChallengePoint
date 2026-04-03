import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import HeaderAndSidebarLayout from "@/components/HeaderAndSidebarLayout";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? null;

  if (!token) {
    redirect("/login");
  }

  const payload = verifyJwt<{ id: string }>(token);

  if (!payload) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { firstName: true, lastName: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <HeaderAndSidebarLayout user={{ firstName: user.firstName ?? "", lastName: user.lastName ?? "" }}>
      {children}
    </HeaderAndSidebarLayout>
  );
}