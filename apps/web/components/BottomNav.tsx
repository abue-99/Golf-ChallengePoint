"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./sidebar";

interface BottomNavProps {
  navItems: NavItem[];
}

export default function BottomNav({ navItems }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {navItems.map(({ href, icon: Icon, label }) => {
        // Exact match for root; prefix match for all other routes
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={label}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
              active
                ? "text-[var(--golf-primary)] font-semibold"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon
              size={22}
              className={active ? "text-[var(--golf-primary)]" : "text-gray-500"}
              strokeWidth={active ? 2.5 : 1.75}
            />
            <span className="leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
