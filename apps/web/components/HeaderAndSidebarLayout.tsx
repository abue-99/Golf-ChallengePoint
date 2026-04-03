
"use client";
import { useState } from 'react';
import Header from './header';
import Sidebar from './sidebar';
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  user: { firstName: string; lastName: string };
};

export default function HeaderAndSidebarLayout({ children, user }: Props) {
 const [expanded,setExpanded]=useState(true);
 return (
  <div className='flex flex-col h-screen'>
    <Header user={user} toggleSidebar={()=>setExpanded(p=>!p)}/>
    <div className='flex flex-row flex-1 overflow-hidden'>
      <Sidebar expanded={expanded}/>
      <main className='flex-1 overflow-auto bg-gray-50 p-4'>{children}</main>
    </div>
  </div>
 );
}
