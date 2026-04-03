import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import type { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Golf Challenge Point",
  description: "Golf Challenge Point – Coaching, Training, Performance Insights",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
