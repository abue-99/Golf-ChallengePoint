
"use client";
import Link from 'next/link';
import { Home, Settings, CalendarDays } from 'lucide-react';
import type { ElementType } from 'react';

export type NavItem = {
  href: string;
  icon: ElementType;
  label: string;
  /** Mobile bottom bar: "more" items are tucked into the "More" menu. */
  mobile?: "primary" | "more";
  /** Count shown on the icon, e.g. unread messages. */
  badge?: number;
  /** Further path prefixes that highlight this item. */
  alsoActive?: string[];
  /** Path prefixes under `href` that belong to another item. */
  exclude?: string[];
};

function under(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

/** Whether the item is the current page (longest match wins in a list). */
export function itemMatches(pathname: string, item: NavItem) {
  if (item.exclude?.some((prefix) => under(pathname, prefix))) return false;
  if (item.href === '/') return pathname === '/';
  return under(pathname, item.href) || Boolean(item.alsoActive?.some((prefix) => under(pathname, prefix)));
}

/** Small red count on a navigation icon. */
export function NavBadge({ count, className = "" }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={`absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white ${className}`}
      aria-label={`${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export const defaultNavItems: NavItem[] = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({
  expanded,
  navItems = defaultNavItems,
}: {
  expanded: boolean;
  toggleSidebar: () => void;
  navItems?: NavItem[];
}) {
  const itemClass = `flex items-center py-2 hover:bg-green-100 whitespace-nowrap ${expanded ? 'gap-3 px-4' : 'justify-center px-0'}`;
  return (
    <aside className={`bg-green-50 overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out ${expanded ? 'w-52' : 'w-12'}`}>
      <nav className='flex flex-col py-4'>
        {navItems.map(({ href, icon: Icon, label, badge }) => (
          <Link
            key={label}
            href={href}
            className={itemClass}
            title={badge ? `${label} (${badge} unread)` : label}
          >
            <span className="relative flex-shrink-0">
              <Icon size={20} className="text-gray-700" />
              <NavBadge count={badge} />
            </span>
            {expanded && <span>{label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
