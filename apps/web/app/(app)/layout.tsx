"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/jwt";
import { cookies } from "next/headers";
import HeaderAndSidebarLayout from "@/components/HeaderAndSidebarLayout";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/auth/me");
        if (!response.ok) {
          router.push("/login");
        }
      } catch (error) {
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  return (
    <HeaderAndSidebarLayout user={{ firstName: "", lastName: "" }}>
      {children}
    </HeaderAndSidebarLayout>
  );
}
