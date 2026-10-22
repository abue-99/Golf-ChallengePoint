"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavItem } from "./sidebar";

interface BottomNavProps {
  navItems: NavItem[];
}

function isActive(pathname: string, href: string) {
  // Exact match for root; prefix match for all other routes
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");
}

const itemClass = (active: boolean) =>
  `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
    active
      ? "text-[var(--golf-primary)] font-semibold"
      : "text-gray-500 hover:text-gray-700"
  }`;

export default function BottomNav({ navItems }: BottomNavProps) {
  const pathname = usePathname();
  const primary = navItems.filter((item) => item.mobile !== "more");
  const more = navItems.filter((item) => item.mobile === "more");
  const moreActive = more.some((item) => isActive(pathname, item.href));

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {primary.map(({ href, icon: Icon, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={label} href={href} className={itemClass(active)}>
            <Icon
              size={22}
              className={active ? "text-[var(--golf-primary)]" : "text-gray-500"}
              strokeWidth={active ? 2.5 : 1.75}
            />
            <span className="leading-none">{label}</span>
          </Link>
        );
      })}
      {more.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={itemClass(moreActive)}>
              <MoreHorizontal
                size={22}
                className={moreActive ? "text-[var(--golf-primary)]" : "text-gray-500"}
                strokeWidth={moreActive ? 2.5 : 1.75}
              />
              <span className="leading-none">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="mb-2 min-w-40">
            {more.map(({ href, icon: Icon, label }) => (
              <DropdownMenuItem key={label} asChild>
                <Link
                  href={href}
                  className={isActive(pathname, href) ? "font-semibold text-[var(--golf-primary)]" : ""}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </nav>
  );
}
