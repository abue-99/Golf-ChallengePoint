"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import AttendanceButtons from "@/components/AttendanceButtons";
import { canAnswer } from "@/lib/attendance";
import type { CalendarActivity } from "@/types/calendar";
import { cn } from "@/lib/utils";
import { formatDateInTimeZone } from "@/lib/timezone";

/** Player home cards about team sessions and the schedule. */

function formatScheduleTime(value: string, timeZone: string) {
  return formatDateInTimeZone(value, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Next team training or team event of the coming two weeks with the
 * "Going / Maybe / Can't make it" buttons right on the home screen.
 */
export function TeamAttendanceCard({
  activities,
  nowIso,
  timeZone,
}: {
  activities: CalendarActivity[];
  nowIso: string;
  timeZone: string;
}) {
  if (!nowIso) return null;
  const now = new Date(nowIso).getTime();
  const horizon = now + 14 * 24 * 60 * 60 * 1000;
  const sessions = activities
    .filter(
      (activity) =>
        canAnswer(activity) && new Date(activity.start).getTime() <= horizon,
    )
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  // Prefer the next session without an answer, otherwise just the next one.
  const next = sessions.find((activity) => !activity.attendance) ?? sessions[0];
  if (!next) return null;
  const openCount = sessions.filter((activity) => !activity.attendance).length;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg">
          {next.type === "team-event" ? "📣" : "👥"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {next.attendance ? "Next team session" : "Are you coming?"}
            {next.occurrenceStatus === "moved" ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 normal-case tracking-normal text-amber-800">
                New time
              </span>
            ) : null}
          </p>
          <p className="truncate font-semibold text-slate-900">{next.title}</p>
          <p className="text-sm text-slate-500">
            {formatDateInTimeZone(next.start, timeZone, {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
            {next.teamName ? ` · ${next.teamName}` : ""}
            {next.location ? ` · ${next.location}` : ""}
          </p>
        </div>
      </div>
      <AttendanceButtons key={next.id} activity={next} compact />
      {openCount > 1 ? (
        <Link
          href="/calendar"
          className="mt-2 block text-xs font-medium text-emerald-700"
        >
          {openCount - 1} more session{openCount - 1 === 1 ? "" : "s"} waiting
          for your answer →
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Team trainings the coach moved or cancelled in the next two weeks, so the
 * player does not show up at the old time.
 */
export function TrainingChangesCard({
  activities,
  nowIso,
  timeZone,
}: {
  activities: CalendarActivity[];
  nowIso: string;
  timeZone: string;
}) {
  if (!nowIso) return null;
  const now = new Date(nowIso).getTime();
  const horizon = now + 14 * 24 * 60 * 60 * 1000;
  const changes = activities
    .filter(
      (activity) =>
        activity.type === "team-practice" &&
        activity.occurrenceStatus &&
        new Date(activity.end).getTime() >= now &&
        new Date(activity.start).getTime() <= horizon,
    )
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 3);
  if (changes.length === 0) return null;
  const when = (value: string) =>
    formatDateInTimeZone(value, timeZone, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
        Changed by your coach
      </p>
      <ul className="space-y-2">
        {changes.map((activity) => {
          const cancelled = activity.occurrenceStatus === "cancelled";
          return (
            <li key={activity.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base",
                  cancelled ? "bg-rose-100" : "bg-amber-100",
                )}
                aria-hidden
              >
                {cancelled ? "✕" : "↪"}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-semibold text-slate-900">
                  {activity.title}
                  {activity.teamName ? (
                    <span className="font-normal text-slate-500">
                      {" "}
                      · {activity.teamName}
                    </span>
                  ) : null}
                </p>
                {cancelled ? (
                  <p className="text-rose-800">
                    <span className="line-through">{when(activity.start)}</span>{" "}
                    – cancelled
                  </p>
                ) : (
                  <p className="text-amber-900">
                    Now {when(activity.start)}
                    {activity.originalStart ? (
                      <span className="text-slate-500">
                        {" "}
                        (was {when(activity.originalStart)})
                      </span>
                    ) : null}
                  </p>
                )}
                {activity.changeReason ? (
                  <p className="truncate text-xs text-slate-600">
                    “{activity.changeReason}”
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CalendarSummaryCard({
  activities,
  nowIso,
  timeZone,
}: {
  activities: CalendarActivity[];
  nowIso: string;
  timeZone: string;
}) {
  const now = nowIso ? new Date(nowIso).getTime() : 0;
  const today = nowIso ? new Date(nowIso) : new Date(0);
  const upcoming = [...activities]
    .filter(
      (activity) =>
        new Date(activity.end).getTime() >= now &&
        activity.occurrenceStatus !== "cancelled",
    )
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const nextUp = upcoming[0] ?? null;
  const todayItems = upcoming
    .filter((activity) => {
      const date = new Date(activity.start);
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    })
    .slice(0, 3);

  return (
    <Link href="/calendar" className="block">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-5 py-4 hover:shadow-md transition-shadow space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Next Up
              </p>
              <p className="font-semibold text-slate-700">
                {nextUp ? nextUp.title : "No scheduled items"}
              </p>
              {nextUp ? (
                <p className="text-xs text-slate-500">
                  {formatScheduleTime(nextUp.start, timeZone)}
                </p>
              ) : null}
            </div>
          </div>
          <span className="text-sm font-semibold text-blue-700">
            Open Calendar
          </span>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Today&apos;s Schedule
          </p>
          <div className="mt-2 space-y-1.5">
            {todayItems.length === 0 ? (
              <p className="text-sm text-slate-500">
                No items scheduled today.
              </p>
            ) : (
              todayItems.map((item) => (
                <div key={item.id} className="text-sm text-slate-600">
                  {formatScheduleTime(item.start, timeZone)} {item.title}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
