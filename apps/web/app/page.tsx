"use client";
import Image from "next/image";
import { useState } from "react";
import { User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AuthModal from "@/components/AuthModal";

export default function WelcomePage() {
  const [authOpen, setAuthOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center bg-green-700 text-white h-14 px-4 gap-4 shadow-md flex-shrink-0">
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
            <button
              onClick={() => setAuthOpen(true)}
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

        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
        />

      {/* Body */}
      <main className="flex-1 overflow-auto flex items-start justify-start p-10">
        <div className="max-w-sm text-left">
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
  );
}
