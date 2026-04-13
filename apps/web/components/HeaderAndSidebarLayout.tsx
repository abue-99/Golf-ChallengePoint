
"use client";
import { useState, useEffect } from 'react';
import Header from './header';
import Sidebar from './sidebar';
import { Home, Settings } from 'lucide-react';
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

 const navItems = role === 'COACH'
   ? [
       { href: '/', icon: Home, label: 'Dashboard' },
       { href: '/teams', icon: Users, label: 'Teams' },
       { href: '/settings', icon: Settings, label: 'Settings' },
     ]
   : defaultNavItems;

 return (
  <div className='flex flex-col h-screen'>
    <Header user={user} onToggleSidebar={() => setExpanded(p => !p)} sidebarExpanded={expanded} />
    <div className='flex flex-row flex-1 overflow-hidden'>
      <Sidebar expanded={expanded} toggleSidebar={()=>setExpanded(p=>!p)} navItems={navItems}/>
      <main className='flex-1 overflow-auto bg-gray-50 p-4'>{children}</main>
    </div>
  </div>
 );
}
