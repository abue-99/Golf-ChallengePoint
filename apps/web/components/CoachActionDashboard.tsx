"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Plus,
  BookOpen,
  Users,
  UserPlus,
  ChevronRight,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodaySlot {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  ownerType: string;
}

interface TeamCard {
  id: string;
  shortName: string;
  icon: string | null;
  memberCount: number;
}

interface AttentionItems {
  playersWithoutLogin: number;
}

interface CoachDashboardData {
  todaySlots: TodaySlot[];
  teamCards: TeamCard[];
  attentionItems: AttentionItems;
  totalPlayers: number;
  totalTeams: number;
  todayTrainingCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TodayAgendaCard({ slots }: { slots: TodaySlot[] }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Tagesagenda</h2>
        </div>
        <Link href="/planning" className="text-xs text-green-700 font-medium hover:underline">
          Alle →
        </Link>
      </div>

      {slots.length === 0 ? (
        <div className="px-4 py-6 text-center text-slate-400">
          <p className="text-xl mb-1">📅</p>
          <p className="text-sm">Keine Termine heute</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {slots.map((slot) => (
            <li key={slot.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
              <span className="text-xs font-mono font-semibold text-slate-400 w-10 flex-shrink-0">
                {formatTime(slot.startTime)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{slot.title}</p>
                <p className="text-xs text-slate-400">
                  bis {formatTime(slot.endTime)}
                  {slot.ownerType === "TEAM" && " · Team"}
                </p>
              </div>
              {slot.ownerType === "TEAM" ? (
                <Users className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
              ) : (
                <CalendarDays className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttentionCard({ items, totalPlayers }: { items: AttentionItems; totalPlayers: number }) {
  const alerts: { label: string; count: number; href: string }[] = [
    ...(items.playersWithoutLogin > 0
      ? [{ label: "Spieler ohne Login (7 Tage)", count: items.playersWithoutLogin, href: "/teams" }]
      : []),
  ];

  if (alerts.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white border border-amber-100 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-amber-600">Aufmerksamkeit benötigt</h2>
      </div>
      <ul className="divide-y divide-slate-50">
        {alerts.map((alert) => (
          <li key={alert.label}>
            <Link href={alert.href} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span className="text-sm text-slate-700">{alert.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5">
                  {alert.count}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamScrollCards({ teams }: { teams: TeamCard[] }) {
  if (teams.length === 0) return null;

  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 px-0.5">
        Teams
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-0.5 px-0.5 snap-x snap-mandatory scrollbar-none">
        {teams.map((team) => (
          <Link key={team.id} href={`/teams/${team.id}`} className="flex-shrink-0 snap-start">
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3 min-w-[120px] hover:shadow-md transition-shadow">
              <div className="text-xl mb-1">{team.icon ?? "⛳"}</div>
              <p className="text-sm font-bold text-slate-800 truncate">{team.shortName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{team.memberCount} Spieler</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── FAB (Floating Action Button) ─────────────────────────────────────────────

interface QuickAction {
  label: string;
  icon: ReactNode;
  href: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Training planen", icon: <CalendarDays className="h-4 w-4" />, href: "/planning" },
  { label: "Lesson erstellen", icon: <BookOpen className="h-4 w-4" />, href: "/coach/lessons" },
  { label: "Spieler hinzufügen", icon: <UserPlus className="h-4 w-4" />, href: "/teams" },
  { label: "Teamtraining", icon: <Users className="h-4 w-4" />, href: "/training-windows" },
];

function QuickActionsInline() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 gap-2">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          onClick={() => router.push(action.href)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-green-300 transition-all shadow-sm text-left"
        >
          <span className="text-green-600 flex-shrink-0">{action.icon}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
}

function MobileFAB() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-[calc(var(--bottom-nav-height)+1rem)] right-4 z-40 md:hidden">
      {/* Action items */}
      {open && (
        <div className="absolute bottom-14 right-0 flex flex-col gap-2 items-end">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => { setOpen(false); router.push(action.href); }}
              className="flex items-center gap-2 rounded-full bg-white border border-slate-200 shadow-md px-4 py-2 text-sm font-medium text-slate-700 whitespace-nowrap hover:bg-slate-50 transition-all"
            >
              <span className="text-green-600">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all",
          open ? "bg-slate-700 rotate-45" : "bg-[var(--golf-primary)]"
        )}
        aria-label="Schnellaktionen"
      >
        {open ? <X className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachActionDashboard() {
  const [data, setData] = useState<CoachDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/coach", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const todayCount = data?.todayTrainingCount ?? 0;

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-4">

      {/* ── Hero ── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 px-5 py-5 text-white shadow-lg">
        <p className="text-sm font-medium text-slate-400">
          {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Coach Overview</h1>

        {!loading && (
          <div className="mt-3 flex gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{todayCount}</p>
              <p className="text-xs text-slate-400">Trainings</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{data?.totalTeams ?? 0}</p>
              <p className="text-xs text-slate-400">Teams</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{data?.totalPlayers ?? 0}</p>
              <p className="text-xs text-slate-400">Spieler</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tagesagenda ── */}
      {loading ? (
        <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
      ) : (
        <TodayAgendaCard slots={data?.todaySlots ?? []} />
      )}

      {/* ── Quick Actions (desktop only – FAB handles mobile) ── */}
      <div className="hidden md:block">
        <QuickActionsInline />
      </div>

      {/* ── Aufmerksamkeit ── */}
      {!loading && data && (
        <AttentionCard items={data.attentionItems} totalPlayers={data.totalPlayers} />
      )}

      {/* ── Team Cards ── */}
      {loading ? (
        <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
      ) : (
        <TeamScrollCards teams={data?.teamCards ?? []} />
      )}

      {/* ── Mobile FAB ── */}
      <MobileFAB />
    </div>
  );
}
