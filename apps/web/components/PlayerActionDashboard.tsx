"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanningMode = "STRUCTURED" | "FLEXIBLE";

interface TodaySlot {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface FlexibleTask {
  id: string;
  name: string;
  focusArea: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "OUTSTANDING" | "STARTED";
  durationMinutes: number;
}

interface ActivePlanSummary {
  id: string;
  name: string;
  blockIndex: number;
  totalBlocks: number;
  activeBlockName: string;
  totalAssignments: number;
  completedAssignments: number;
}

interface NextSlot {
  id: string;
  title: string;
  startTime: string;
}

interface PlayerDashboardData {
  todaySlots: TodaySlot[];
  nextSlot: NextSlot | null;
  activePlanSummary: ActivePlanSummary | null;
  flexibleTasks: FlexibleTask[];
  todayCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FOCUS_AREA_COLOR: Record<string, string> = {
  PUTTING: "bg-violet-100 text-violet-700",
  SHORT_GAME: "bg-orange-100 text-orange-700",
  LONG_GAME: "bg-blue-100 text-blue-700",
  FITNESS: "bg-green-100 text-green-700",
  MENTAL: "bg-teal-100 text-teal-700",
  TACTICAL: "bg-red-100 text-red-800",
  SETUP: "bg-slate-100 text-slate-600",
};

const FOCUS_AREA_LABEL: Record<string, string> = {
  PUTTING: "Putting",
  SHORT_GAME: "Kurzes Spiel",
  LONG_GAME: "Langes Spiel",
  FITNESS: "Fitness",
  MENTAL: "Mental",
  TACTICAL: "Taktik",
  SETUP: "Setup",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

function getPriorityIcon(priority: string): ReactNode {
  if (priority === "HIGH") return <Flame className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />;
  if (priority === "MEDIUM") return <span className="text-slate-400 flex-shrink-0 text-sm leading-none">●</span>;
  return <span className="text-slate-300 flex-shrink-0 text-sm leading-none">○</span>;
}

function getSlotStatus(slot: TodaySlot): "done" | "active" | "open" {
  const now = new Date();
  const end = new Date(slot.endTime);
  const start = new Date(slot.startTime);
  if (now > end) return "done";
  if (now >= start) return "active";
  return "open";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
}: {
  mode: PlanningMode;
  onChange: (m: PlanningMode) => void;
}) {
  return (
    <div className="flex rounded-full bg-white/20 p-0.5 gap-0.5">
      {(["STRUCTURED", "FLEXIBLE"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-all",
            mode === m
              ? "bg-white text-green-800 shadow-sm"
              : "text-white/80 hover:text-white"
          )}
        >
          {m === "STRUCTURED" ? "Strukturiert" : "Flexibel"}
        </button>
      ))}
    </div>
  );
}

function StructuredToday({ slots }: { slots: TodaySlot[] }) {
  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-2xl mb-2">🎉</p>
        <p className="font-medium text-slate-600">Keine Einheiten heute</p>
        <p className="text-sm mt-1">Gut erholen!</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {slots.map((slot) => {
        const status = getSlotStatus(slot);
        return (
          <li
            key={slot.id}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
              status === "done" ? "bg-slate-50 opacity-60" : "bg-white border border-slate-100 shadow-sm"
            )}
          >
            <span className="text-xs font-mono font-semibold text-slate-400 w-10 flex-shrink-0">
              {formatTime(slot.startTime)}
            </span>
            <span className="flex-1 text-sm font-medium text-slate-800 leading-tight">
              {slot.title}
            </span>
            <span className="text-lg flex-shrink-0">
              {status === "done" ? "✅" : status === "active" ? "▶️" : "⏳"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function FlexibleToday({ tasks }: { tasks: FlexibleTask[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-2xl mb-2">🏆</p>
        <p className="font-medium text-slate-600">Alles erledigt!</p>
        <p className="text-sm mt-1">Keine offenen Aufgaben.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const done = checked.has(task.id);
        return (
          <li
            key={task.id}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-3 bg-white border border-slate-100 shadow-sm transition-all",
              done && "opacity-50"
            )}
          >
            <button
              onClick={() =>
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (done) next.delete(task.id);
                  else next.add(task.id);
                  return next;
                })
              }
              className={cn(
                "h-5 w-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors",
                done ? "bg-green-500 border-green-500" : "border-slate-300 hover:border-green-400"
              )}
              aria-label={done ? "Als offen markieren" : "Als erledigt markieren"}
            >
              {done && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <span className={cn("text-sm font-medium text-slate-800", done && "line-through text-slate-400")}>
                {task.name}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", FOCUS_AREA_COLOR[task.focusArea] ?? "bg-slate-100 text-slate-600")}>
                  {FOCUS_AREA_LABEL[task.focusArea] ?? task.focusArea}
                </span>
              </div>
            </div>
            {getPriorityIcon(task.priority)}
          </li>
        );
      })}
    </ul>
  );
}

function NextHighlightCard({ nextSlot }: { nextSlot: NextSlot | null }) {
  if (!nextSlot) {
    return (
      <Link href="/planning">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 flex items-center justify-between hover:border-green-300 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-green-50 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nächster Termin</p>
              <p className="text-sm font-medium text-slate-500">Keine geplant</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300" />
        </div>
      </Link>
    );
  }

  return (
    <Link href="/calendar">
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nächster Termin</p>
            <p className="text-sm font-bold text-slate-800">{nextSlot.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{formatDate(nextSlot.startTime)} · {formatTime(nextSlot.startTime)}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
    </Link>
  );
}

function DevPlanCard({ plan }: { plan: ActivePlanSummary | null }) {
  if (!plan) return null;

  const pct = plan.totalAssignments > 0
    ? Math.round((plan.completedAssignments / plan.totalAssignments) * 100)
    : 0;

  return (
    <Link href="/player">
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Entwicklungsplan</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{plan.name}</p>
            <p className="text-xs text-slate-500">
              Block {plan.blockIndex} von {plan.totalBlocks} · {plan.activeBlockName}
            </p>
          </div>
          <span className="text-sm font-bold text-green-600 flex-shrink-0 ml-2">{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlayerActionDashboard({
  firstName,
  initialMode = "STRUCTURED",
}: {
  firstName: string;
  initialMode?: PlanningMode;
}) {
  const [mode, setMode] = useState<PlanningMode>(initialMode);
  const [data, setData] = useState<PlayerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/player", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const todayCount = data?.todayCount ?? 0;

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-4">

      {/* ── Hero ── */}
      <div className="rounded-2xl bg-gradient-to-br from-green-700 via-green-800 to-emerald-900 px-5 py-5 text-white shadow-lg">
        <p className="text-sm font-medium text-green-300">{dateLabel}</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
          {getGreeting()}, {firstName || "Golfer"} 👋
        </h1>
        {!loading && (
          <p className="mt-1 text-sm text-green-200">
            {todayCount === 0
              ? "Heute keine Trainingseinheiten geplant."
              : `Heute ${todayCount === 1 ? "steht 1 Trainingseinheit" : `stehen ${todayCount} Trainingseinheiten`} an.`}
          </p>
        )}
        <div className="mt-3">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      {/* ── Heute ── */}
      <div className="rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden">
        <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Heute</h2>
          <Link href="/calendar" className="text-xs text-green-700 font-medium hover:underline">
            Kalender →
          </Link>
        </div>
        <div className="px-3 py-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : mode === "STRUCTURED" ? (
            <StructuredToday slots={data?.todaySlots ?? []} />
          ) : (
            <FlexibleToday tasks={data?.flexibleTasks ?? []} />
          )}
        </div>
      </div>

      {/* ── Next Highlight ── */}
      {loading ? (
        <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
      ) : (
        <NextHighlightCard nextSlot={data?.nextSlot ?? null} />
      )}

      {/* ── Development Plan ── */}
      {loading ? (
        <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
      ) : (
        <DevPlanCard plan={data?.activePlanSummary ?? null} />
      )}
    </div>
  );
}
