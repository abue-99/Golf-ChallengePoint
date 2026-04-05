
"use client";
import Link from 'next/link';
import { Home, Calendar, CheckSquare, BarChart, Settings } from 'lucide-react';
export default function Sidebar({ expanded }: { expanded: boolean; toggleSidebar: () => void }) {
  const itemClass = `flex items-center py-2 hover:bg-green-100 whitespace-nowrap ${expanded ? 'gap-3 px-4' : 'justify-center px-0'}`;
  return (
    <aside className={`bg-green-50 overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out ${expanded ? 'w-64' : 'w-12'}`}>
      <nav className='flex flex-col py-4'>
        <Link href='/' className={itemClass} title='Dashboard'><Home size={18} className="text-gray-700"/>{expanded && <span>Dashboard</span>}</Link>
        <Link href='/today' className={itemClass} title='Today'><Calendar size={18} className="text-gray-700"/>{expanded && <span>Today</span>}</Link>
        <Link href='/tasks' className={itemClass} title='Tasks'><CheckSquare size={18} className="text-gray-700"/>{expanded && <span>Tasks</span>}</Link>
        <Link href='/stats' className={itemClass} title='Stats'><BarChart size={18} className="text-gray-700"/>{expanded && <span>Stats</span>}</Link>
        <Link href='/settings' className={itemClass} title='Settings'><Settings size={18} className="text-gray-700"/>{expanded && <span>Settings</span>}</Link>
      </nav>
    </aside>
  );
}
