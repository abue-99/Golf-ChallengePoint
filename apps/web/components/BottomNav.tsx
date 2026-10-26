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
import { itemMatches, NavBadge, type NavItem } from "./sidebar";

interface BottomNavProps {
  navItems: NavItem[];
}

/** Active item: the matching item with the longest href. */
function activeHref(pathname: string, items: NavItem[]) {
  return items
    .filter((item) => itemMatches(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
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
  const current = activeHref(pathname, navItems);
  const moreActive = more.some((item) => item.href === current);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {primary.map(({ href, icon: Icon, label, badge }) => {
        const active = href === current;
        return (
          <Link key={label} href={href} className={itemClass(active)}>
            <span className="relative">
              <Icon
                size={22}
                className={active ? "text-[var(--golf-primary)]" : "text-gray-500"}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <NavBadge count={badge} />
            </span>
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
                  className={href === current ? "font-semibold text-[var(--golf-primary)]" : ""}
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
