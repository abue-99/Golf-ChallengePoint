
"use client";
import Link from 'next/link';
import { Home, Settings } from 'lucide-react';
import type { ElementType } from 'react';

export type NavItem = {
  href: string;
  icon: ElementType;
  label: string;
};

export const defaultNavItems: NavItem[] = [
  { href: '/', icon: Home, label: 'Dashboard' },
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
    <aside className={`bg-green-50 overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out ${expanded ? 'w-44' : 'w-12'}`}>
      <nav className='flex flex-col py-4'>
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link key={label} href={href} className={itemClass} title={label}>
            <Icon size={18} className="text-gray-700" />
            {expanded && <span>{label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
