import "./globals.css";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Golf Challenge Point",
  description: "Golf Challenge Point – Coaching, Training, Performance Insights",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Golf CP",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#15803d",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
