"use client";

import { Check, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachAttendance } from "@/types/coach-calendar";
import { attendanceLabel } from "./shared";

/** ✓ 5 · ? 1 · ✗ 2 · 3 open – compact counters for chips and calendar events. */
export function AttendanceCounts({
  attendance,
  className,
  compact = false,
}: {
  attendance: CoachAttendance;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}
      aria-label={attendanceLabel(attendance)}
      title={attendanceLabel(attendance)}
    >
      <span className="inline-flex items-center gap-0.5 text-emerald-700">
        <Check className="h-3 w-3" aria-hidden />
        {attendance.going}
      </span>
      {attendance.maybe > 0 || !compact ? (
        <span className="inline-flex items-center gap-0.5 text-amber-700">
          <HelpCircle className="h-3 w-3" aria-hidden />
          {attendance.maybe}
        </span>
      ) : null}
      <span
        className={cn(
          "inline-flex items-center gap-0.5",
          attendance.notGoing ? "text-rose-700" : "text-slate-400",
        )}
      >
        <X className="h-3 w-3" aria-hidden />
        {attendance.notGoing}
      </span>
      {attendance.open > 0 ? (
        <span className="whitespace-nowrap rounded-full bg-slate-900/10 px-1.5 text-[0.7rem] font-semibold text-slate-700">
          {attendance.open} open
        </span>
      ) : null}
    </span>
  );
}

/** Stacked bar of the answers (going / maybe / not going / open). */
export function AttendanceBar({ attendance }: { attendance: CoachAttendance }) {
  const total = Math.max(1, attendance.members);
  const part = (value: number) => `${(value / total) * 100}%`;
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100"
      aria-hidden
    >
      <span
        className="bg-emerald-500"
        style={{ width: part(attendance.going) }}
      />
      <span
        className="bg-amber-400"
        style={{ width: part(attendance.maybe) }}
      />
      <span
        className="bg-rose-500"
        style={{ width: part(attendance.notGoing) }}
      />
    </div>
  );
}

/** Who answered what, with reasons, and who has not answered yet. */
export default function AttendancePanel({
  attendance,
}: {
  attendance: CoachAttendance;
}) {
  const groups = [
    { label: "Can't make it", status: "NOT_GOING", tone: "text-rose-700" },
    { label: "Maybe", status: "MAYBE", tone: "text-amber-700" },
    { label: "Going", status: "GOING", tone: "text-emerald-700" },
  ] as const;

  if (attendance.members === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
        This team has no players yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {attendance.going} of {attendance.members} going
          </span>
          <AttendanceCounts attendance={attendance} className="text-xs" />
        </div>
        <AttendanceBar attendance={attendance} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => {
          const people = attendance.responses.filter(
            (response) => response.status === group.status,
          );
          if (people.length === 0) return null;
          return (
            <div key={group.status} className="min-w-0">
              <p className={cn("text-xs font-semibold", group.tone)}>
                {group.label} ({people.length})
              </p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {people.map((response) => (
                  <li key={response.playerId} className="break-words">
                    {response.name}
                    {response.note ? (
                      <span className="text-slate-500">
                        {" "}
                        – “{response.note}”
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {attendance.openPlayers.length > 0 ? (
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">
              No answer yet ({attendance.openPlayers.length})
            </p>
            <ul className="mt-1 space-y-1 text-sm text-slate-600">
              {attendance.openPlayers.map((player) => (
                <li key={player.playerId}>{player.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
