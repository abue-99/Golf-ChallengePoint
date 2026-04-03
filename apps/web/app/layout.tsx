import "./globals.css";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { verifyJwt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import HeaderAndSidebarLayout from "@/components/HeaderAndSidebarLayout";
import type { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Golf Challenge Point",
  description: "Golf Challenge Point – Coaching, Training, Performance Insights",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let user = { firstName: "", lastName: "" };

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value ?? null;

    if (token) {
      const payload = verifyJwt<{ id: string }>(token);

      if (payload) {
        const dbUser = await prisma.user.findUnique({
          where: { id: payload.id },
          select: { firstName: true, lastName: true },
        });

        if (dbUser) {
          user = {
            firstName: dbUser.firstName ?? "",
            lastName: dbUser.lastName ?? "",
          };
        }
      }
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <HeaderAndSidebarLayout user={user}>
          {children}
        </HeaderAndSidebarLayout>
      </body>
    </html>
  );
}