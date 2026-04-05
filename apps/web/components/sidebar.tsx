
"use client";
import Link from 'next/link';
import { Home, Calendar, CheckSquare, BarChart, Settings } from 'lucide-react';
export default function Sidebar({expanded}:{expanded:boolean}){
 return (
  <aside className={`bg-white border-r overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'fixed md:static top-14 bottom-0 left-0 z-40 w-64 md:h-full' : 'hidden md:block md:w-12 md:h-full'}`}>
    <nav className='flex flex-col py-4'>
      <Link href='/' className={`flex items-center py-2 hover:bg-gray-100 whitespace-nowrap ${expanded ? 'gap-3 px-4' : 'justify-center px-0'}`} title='Dashboard'><Home size={18}/>{expanded && <span>Dashboard</span>}</Link>
      <Link href='/today' className={`flex items-center py-2 hover:bg-gray-100 whitespace-nowrap ${expanded ? 'gap-3 px-4' : 'justify-center px-0'}`} title='Today'><Calendar size={18}/>{expanded && <span>Today</span>}</Link>
      <Link href='/tasks' className={`flex items-center py-2 hover:bg-gray-100 whitespace-nowrap ${expanded ? 'gap-3 px-4' : 'justify-center px-0'}`} title='Tasks'><CheckSquare size={18}/>{expanded && <span>Tasks</span>}</Link>
      <Link href='/stats' className={`flex items-center py-2 hover:bg-gray-100 whitespace-nowrap ${expanded ? 'gap-3 px-4' : 'justify-center px-0'}`} title='Stats'><BarChart size={18}/>{expanded && <span>Stats</span>}</Link>
      <Link href='/settings' className={`flex items-center py-2 hover:bg-gray-100 whitespace-nowrap ${expanded ? 'gap-3 px-4' : 'justify-center px-0'}`} title='Settings'><Settings size={18}/>{expanded && <span>Settings</span>}</Link>
    </nav>
  </aside>
 );
}
