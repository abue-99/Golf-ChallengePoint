"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusMeta, personName, type Person } from "@/lib/game";
import { Stars } from "@/components/game/bits";

export type WorkItem = {
  id: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  stars: number | null;
  reviewed: boolean;
  name: string;
  focusArea: string;
  durationMinutes: number;
  journey: string | null;
  team: string | null;
  assignedBy: Person | null;
  mine: boolean;
};

export async function loadPlayerWork(playerId: string): Promise<WorkItem[]> {
  const res = await fetch(
    `/api/coach/roster/players/${encodeURIComponent(playerId)}/work`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const STATUS: Record<string, string> = {
  NEW: "New",
  OPEN: "Accepted",
  IN_PROGRESS: "In play",
  COMPLETED: "Done",
};

/** Open and recent missions of a player from every coach – with "assigned by". */
export default function AssignedWork({ playerId }: { playerId: string }) {
  const [items, setItems] = useState<WorkItem[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadPlayerWork(playerId)
      .then((data) => !cancelled && setItems(data))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (!items) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }
  if (items.length === 0)
    return <p className="text-sm text-slate-500">No open missions.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2 text-sm">
          <span className="text-base">{focusMeta(item.focusArea).emoji}</span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate",
                item.status === "COMPLETED"
                  ? "text-slate-500"
                  : "font-medium text-slate-800",
              )}
            >
              {item.name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {STATUS[item.status] ?? item.status}
              {item.journey ? ` · ${item.journey}` : ""}
              {item.dueDate && item.status !== "COMPLETED"
                ? ` · due ${new Date(item.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                : ""}
            </p>
          </div>
          {item.stars ? <Stars value={item.stars} size={11} /> : null}
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              item.mine
                ? "bg-emerald-50 text-emerald-700"
                : "bg-sky-50 text-sky-700",
            )}
            title="Assigned by"
          >
            {item.mine ? "You" : personName(item.assignedBy) || "Coach"}
          </span>
        </li>
      ))}
    </ul>
  );
}
