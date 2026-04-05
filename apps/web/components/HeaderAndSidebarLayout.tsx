
"use client";
import { useState, useEffect } from 'react';
import Header from './header';
import Sidebar from './sidebar';
import type { ReactNode } from "react";

export default function HeaderAndSidebarLayout({
  children,
  user,
}: {
  children: ReactNode;
  user: { firstName: string; lastName: string };
}) {
 const [expanded,setExpanded]=useState(false);
 useEffect(() => {
   const handleKeyDown = (e: KeyboardEvent) => {
     if (e.key === 'Escape' && expanded) setExpanded(false);
   };
   document.addEventListener('keydown', handleKeyDown);
   return () => document.removeEventListener('keydown', handleKeyDown);
 }, [expanded]);
 return (
  <div className='flex flex-col h-screen'>
    <Header user={user} toggleSidebar={()=>setExpanded(p=>!p)} sidebarOpen={expanded}/>
    <div className='flex flex-row flex-1 overflow-hidden'>
      {expanded && (
        <div
          className='fixed inset-0 top-14 bg-black/40 z-30 md:hidden'
          aria-hidden='true'
          onClick={() => setExpanded(false)}
        />
      )}
      <Sidebar expanded={expanded}/>
      <main className='flex-1 overflow-auto bg-gray-50 p-4'>{children}</main>
    </div>
  </div>
 );
}
