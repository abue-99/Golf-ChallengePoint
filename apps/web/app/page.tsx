"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Home,
  Calendar,
  CheckSquare,
  BarChart,
  Settings,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/login", icon: Home, label: "Dashboard" },
  { href: "/login", icon: Calendar, label: "Today" },
  { href: "/login", icon: CheckSquare, label: "Tasks" },
  { href: "/login", icon: BarChart, label: "Stats" },
  { href: "/login", icon: Settings, label: "Settings" },
];

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center bg-green-700 text-white h-14 px-4 gap-4 shadow-md">
        <Image
          src="/GolfChallengePoint_Logo_Inv_48x48.png"
          alt="Golf Challenge Point"
          width={48}
          height={48}
          priority
        />
        <span className="font-bold text-lg">Golf Challenge Point</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => router.push("/login")}
            className="flex items-center gap-2 focus:outline-none rounded-full ring-offset-2 focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Login"
          >
            <Avatar className="h-8 w-8 border-2 border-white/50">
              <AvatarFallback className="bg-green-800 text-white text-xs font-semibold">
                <User size={14} />
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="bg-white border-r w-64">
          <nav className="flex flex-col py-4">
            {navItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 px-4 py-2 text-[var(--golf-heading)] hover:bg-gray-100"
              >
                <Icon className="h-5 w-5 text-[var(--golf-primary)]" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex items-start justify-end p-10">
          <div className="max-w-sm text-right">
            <h1 className="text-2xl font-bold text-[var(--golf-heading)] mb-2">
              Willkommen bei Golf Challenge Point
            </h1>
            <p className="text-sm text-[var(--golf-muted-text)]">
              Bitte melde dich an, um deine Challenges, Fortschritte und
              Trainingseinheiten zu verwalten.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}