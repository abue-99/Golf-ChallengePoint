"use client";

import { useEffect, useState } from "react";
import PlayerActionDashboard from "@/components/PlayerActionDashboard";
import CoachActionDashboard from "@/components/CoachActionDashboard";

export default function Dashboard() {
  const [role, setRole] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me?.role) setRole(me.role);
        if (me?.firstName) setFirstName(me.firstName);
      });
  }, []);

  if (role === "PLAYER") {
    return <PlayerActionDashboard firstName={firstName} />;
  }

  if (role === "COACH" || role === "ADMIN") {
    return <CoachActionDashboard />;
  }

  if (role === "SYSADMIN") {
    return (
      <div className="space-y-3 px-0">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--golf-heading)]">Dashboard</h1>
        <p className="text-sm text-[var(--golf-muted-text)]">
          System administration overview. Use Settings to manage clubs and users.
        </p>
      </div>
    );
  }

  // Loading state
  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
      <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
      <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
    </div>
  );
}
