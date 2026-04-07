"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import {
  Home,
  Calendar,
  CheckSquare,
  BarChart,
  Settings,
  User,
  Menu,
  LogIn,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Sidebar, { type NavItem } from "@/components/sidebar";
import AuthModal from "@/components/AuthModal";

const navItems: NavItem[] = [
  { href: "/login", icon: Home, label: "Dashboard" },
  { href: "/login", icon: Calendar, label: "Today" },
  { href: "/login", icon: CheckSquare, label: "Tasks" },
  { href: "/login", icon: BarChart, label: "Stats" },
  { href: "/login", icon: Settings, label: "Settings" },
];

export default function WelcomePage() {
  const [expanded, setExpanded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");

  function openAuth(tab: "login" | "signup") {
    setAuthTab(tab);
    setAuthOpen(true);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expanded) setExpanded(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center bg-green-700 text-white h-14 px-4 gap-4 shadow-md flex-shrink-0">
        <button
          onClick={() => setExpanded((p) => !p)}
          aria-label="Toggle sidebar"
          className="flex items-center justify-center rounded p-1 -ml-1 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Menu size={22} className="text-white" />
        </button>
        <Image
          src="/GolfChallengePoint_Logo_Inv_48x48.png"
          alt="Golf Challenge Point"
          width={40}
          height={40}
          priority
          className="ml-1"
        />
        <span className="font-bold text-lg">Golf Challenge Point</span>
        <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 focus:outline-none rounded-full ring-offset-2 focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="User menu"
                >
                  <Avatar className="h-8 w-8 border-2 border-white/50">
                    <AvatarFallback className="bg-green-800 text-white text-xs font-semibold">
                      <User size={14} />
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Your profile and settings
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openAuth("login")}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAuth("signup")}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Up
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          defaultTab={authTab}
        />

      {/* Body */}
      <div className="flex flex-row flex-1 overflow-hidden">
        <Sidebar expanded={expanded} toggleSidebar={() => setExpanded((p) => !p)} navItems={navItems} />

        {/* Main content */}
        <main className="flex-1 overflow-auto flex items-start justify-end p-10">
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
