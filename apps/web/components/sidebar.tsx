
"use client";
import Link from 'next/link';
import { Home, Calendar, CheckSquare, BarChart, Settings } from 'lucide-react';
export default function Sidebar({expanded}:{expanded:boolean}){
 return (
  <aside className={`bg-white border-r h-full overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}>
    <nav className='flex flex-col py-4 w-64'>
      <Link href='/' className='flex items-center gap-3 px-4 py-2 hover:bg-gray-100 whitespace-nowrap'><Home size={18}/> Dashboard</Link>
      <Link href='/today' className='flex items-center gap-3 px-4 py-2 hover:bg-gray-100 whitespace-nowrap'><Calendar size={18}/> Today</Link>
      <Link href='/tasks' className='flex items-center gap-3 px-4 py-2 hover:bg-gray-100 whitespace-nowrap'><CheckSquare size={18}/> Tasks</Link>
      <Link href='/stats' className='flex items-center gap-3 px-4 py-2 hover:bg-gray-100 whitespace-nowrap'><BarChart size={18}/> Stats</Link>
      <Link href='/settings' className='flex items-center gap-3 px-4 py-2 hover:bg-gray-100 whitespace-nowrap'><Settings size={18}/> Settings</Link>
    </nav>
  </aside>
 );
}
