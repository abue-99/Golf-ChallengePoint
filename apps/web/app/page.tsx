"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Sidebar from "@/components/sidebar";

export default function WelcomePage() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

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
          className="flex items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white p-1 -ml-1 hover:bg-white/20 transition-colors"
        >
          <Menu size={22} className="text-white" />
        </button>
        <Image
          src="/GolfChallengePoint_Logo_Inv_48x48.png"
          alt="Golf Challenge Point"
          width={40}
          height={40}
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
      <div className="flex flex-1 overflow-hidden">
        <Sidebar expanded={expanded} toggleSidebar={() => setExpanded((p) => !p)} />

        {/* Main content */}
        <main className="flex-1 overflow-auto flex items-start justify-end p-10 bg-gray-50">
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