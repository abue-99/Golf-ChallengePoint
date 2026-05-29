
"use client";
import { useState, useEffect } from 'react';
import Header from './header';
import Sidebar from './sidebar';
import BottomNav from './BottomNav';
import { Home, Settings, CalendarDays } from 'lucide-react';
import { Users } from 'lucide-react';
import type { ReactNode } from "react";
import { defaultNavItems } from './sidebar';

export default function HeaderAndSidebarLayout({
  children,
  user,
  role,
}: {
  children: ReactNode;
  user: { firstName: string; lastName: string; email?: string; profileImage?: string };
  role?: string;
}) {
 const [expanded,setExpanded]=useState(false);
 useEffect(() => {
   const handleKeyDown = (e: KeyboardEvent) => {
     if (e.key === 'Escape' && expanded) setExpanded(false);
   };
   document.addEventListener('keydown', handleKeyDown);
   return () => document.removeEventListener('keydown', handleKeyDown);
 }, [expanded]);

 const navItems = (role === 'COACH' || role === 'ADMIN')
   ? [
       { href: '/', icon: Home, label: 'Dashboard' },
       { href: '/teams', icon: Users, label: 'Teams' },
       { href: '/settings', icon: Settings, label: 'Settings' },
     ]
   : role === 'PLAYER'
   ? [
       { href: '/', icon: Home, label: 'Dashboard' },
       { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
       { href: '/settings', icon: Settings, label: 'Settings' },
     ]
   : defaultNavItems;

 return (
  <div className='flex flex-col h-[100dvh]'>
    <Header user={user} onToggleSidebar={() => setExpanded(p => !p)} sidebarExpanded={expanded} />
    <div className='flex flex-row flex-1 overflow-hidden'>
      {/* Desktop sidebar – hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar expanded={expanded} toggleSidebar={() => setExpanded(p => !p)} navItems={navItems} />
      </div>

      {/* Mobile drawer overlay */}
      {expanded && (
        <div className="md:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setExpanded(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 w-64 bg-green-50 h-full shadow-xl">
            <Sidebar expanded={true} toggleSidebar={() => setExpanded(false)} navItems={navItems} />
          </div>
        </div>
      )}

      {/* Main content — extra bottom padding on mobile for bottom nav */}
      <main className='flex-1 overflow-auto bg-gray-50 p-4 pb-[calc(var(--bottom-nav-height)+1rem)] md:pb-4'>
        {children}
      </main>
    </div>

    {/* Mobile bottom tab bar */}
    <BottomNav navItems={navItems} />
  </div>
 );
}
