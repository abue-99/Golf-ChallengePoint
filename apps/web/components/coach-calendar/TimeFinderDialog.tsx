"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ApiError, createOneTimeTraining } from "@/lib/coach-calendar";
import {
  buildGrid,
  describeWindow,
  heatClass,
  slotStarts,
  startOfWeek,
  STEP_MINUTES,
  suggestWindows,
  weekDays,
  type AvailabilityPayload,
  type Window,
} from "@/lib/time-finder";
import type {
  CoachCalendarPayload,
  CoachCalendarTeam,
} from "@/types/coach-calendar";
import { formatTime } from "./shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const DURATIONS = [60, 90, 120];

function dayLabel(date: Date) {
  return date.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function windowLabel(window: Window) {
  return `${dayLabel(window.start)} · ${formatTime(window.start.toISOString())}–${formatTime(window.end.toISOString())}`;
}

async function loadJson<T>(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        `Could not load (${res.status})`,
    );
  }
  return data as T;
}

/**
 * Find a time for the whole team: a week heatmap of how many players are
 * free (absences, tournaments, trainings and events of all their teams),
 * suggestions for the chosen length, and planning right from the result.
 */
export default function TimeFinderDialog({
  open,
  teams,
  defaultTeamId,
  onClose,
  onPlanEvent,
  onTrainingCreated,
}: {
  open: boolean;
  teams: CoachCalendarTeam[];
  defaultTeamId: string | null;
  onClose: () => void;
  /** Opens the team event dialog with this time. */
  onPlanEvent: (teamId: string, window: Window) => void;
  onTrainingCreated: (slotId: string, title: string, window: Window) => void;
}) {
  const [teamId, setTeamId] = useState(defaultTeamId ?? teams[0]?.id ?? "");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [duration, setDuration] = useState(90);
  const [data, setData] = useState<AvailabilityPayload | null>(null);
  const [coachBusy, setCoachBusy] = useState<Window[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Date | null>(null);
  const [title, setTitle] = useState("Team training");
  const [creating, setCreating] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [now] = useState(() => Date.now());

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const weekEnd = useMemo(() => new Date(days[6].getTime() + DAY_MS), [days]);
  const requestKey = `${teamId}|${weekStart.toISOString()}`;
  const loading = requestKey !== loadedKey;

  useEffect(() => {
    if (!open || !teamId) return;
    let cancelled = false;
    const params = new URLSearchParams({
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
    });
    Promise.all([
      loadJson<AvailabilityPayload>(
        `/api/calendar/coach/teams/${encodeURIComponent(teamId)}/availability?${params}`,
      ),
      // The coach's own sessions (all teams) – the coach cannot be in two places.
      loadJson<CoachCalendarPayload>(`/api/calendar/coach?${params}`).catch(
        () => null,
      ),
    ])
      .then(([availability, calendar]) => {
        if (cancelled) return;
        setData(availability);
        setCoachBusy(
          (calendar?.activities ?? [])
            .filter(
              (activity) =>
                (activity.type === "team-practice" ||
                  activity.type === "team-event" ||
                  (activity.type === "coach-assignment" &&
                    activity.createdById === calendar?.viewerId &&
                    Boolean(activity.playerName))) &&
                activity.occurrenceStatus !== "cancelled" &&
                !activity.allDay,
            )
            .map((activity) => ({
              start: new Date(activity.start),
              end: new Date(activity.end),
            })),
        );
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(err instanceof Error ? err.message : "Could not load");
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [open, requestKey, teamId, weekEnd, weekStart]);

  const members = useMemo(() => data?.members ?? [], [data]);
  const grid = useMemo(
    () => buildGrid(members, days, coachBusy, now),
    [coachBusy, days, members, now],
  );
  const suggestions = useMemo(
    () => suggestWindows(members, days, duration, coachBusy, now),
    [coachBusy, days, duration, members, now],
  );
  const selection = selected
    ? describeWindow(
        members,
        {
          start: selected,
          end: new Date(selected.getTime() + duration * 60_000),
        },
        coachBusy,
        now,
      )
    : null;
  const rows = slotStarts(days[0]);

  const isSelectedCell = (start: Date) =>
    Boolean(
      selected &&
      start.getTime() >= selected.getTime() &&
      start.getTime() < selected.getTime() + duration * 60_000,
    );

  const moveWeek = (weeks: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + weeks * 7);
    setWeekStart(next);
    setSelected(null);
    setConflicts([]);
  };

  const createTraining = async (force = false) => {
    if (!selection || !teamId) return;
    setCreating(true);
    try {
      const slot = await createOneTimeTraining({
        teamId,
        title: title.trim() || "Team training",
        startTime: selection.start.toISOString(),
        endTime: selection.end.toISOString(),
        force,
      });
      setConflicts([]);
      onTrainingCreated(slot.id, title.trim() || "Team training", selection);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflicts(err.conflicts.length ? err.conflicts : [err.message]);
      } else {
        setError(err instanceof Error ? err.message : "Could not create it");
      }
    } finally {
      setCreating(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-h-[94dvh] max-w-5xl overflow-y-auto p-3 sm:p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <DialogHeader>
              <DialogTitle>Find a time</DialogTitle>
            </DialogHeader>
            <p className="-mt-1 text-xs text-slate-500">
              When can the team come? Based on school, work, holidays,
              tournaments and the trainings and events of all their teams.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 pointer-coarse:h-11 pointer-coarse:w-11"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="tf-team" className="block text-xs">
              Team
            </Label>
            <select
              id="tf-team"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm pointer-coarse:h-11"
              value={teamId}
              onChange={(event) => {
                setTeamId(event.target.value);
                setSelected(null);
                setConflicts([]);
              }}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.shortName} ({team.memberCount})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <span className="block text-xs font-medium">Length</span>
            <div className="flex rounded-md border bg-white p-0.5">
              {DURATIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={duration === minutes}
                  onClick={() => setDuration(minutes)}
                  className={cn(
                    "h-9 rounded px-3 text-sm tabular-nums pointer-coarse:h-10",
                    duration === minutes
                      ? "bg-green-600 font-semibold text-white"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous week"
              className="pointer-coarse:h-11 pointer-coarse:w-11"
              disabled={
                weekStart.getTime() <= startOfWeek(new Date()).getTime()
              }
              onClick={() => moveWeek(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold text-slate-800">
              {dayLabel(days[0])} – {dayLabel(days[6])}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next week"
              className="pointer-coarse:h-11 pointer-coarse:w-11"
              onClick={() => moveWeek(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        {data && members.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed px-3 py-6 text-center text-sm text-slate-500">
            This team has no players yet.
          </p>
        ) : null}

        {members.length > 0 ? (
          <section className="mt-3">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-green-600" /> Best times for{" "}
              {duration} min
            </h3>
            {suggestions.length === 0 ? (
              <p className="text-sm text-slate-500">
                No free time this week – try another week or a shorter session.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.start.toISOString()}
                    type="button"
                    onClick={() => {
                      setSelected(suggestion.start);
                      setConflicts([]);
                    }}
                    aria-pressed={
                      selected?.getTime() === suggestion.start.getTime()
                    }
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm pointer-coarse:min-h-11",
                      selected?.getTime() === suggestion.start.getTime()
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                    )}
                  >
                    <span>{windowLabel(suggestion)}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs font-semibold",
                        suggestion.free === suggestion.total
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800",
                      )}
                    >
                      {suggestion.free === suggestion.total
                        ? "all"
                        : `${suggestion.free}/${suggestion.total}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {members.length > 0 ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div
              className={cn(
                "overflow-x-auto rounded-xl border bg-white",
                loading && "opacity-60",
              )}
            >
              <table
                className="w-full min-w-[400px] table-fixed border-collapse text-xs"
                aria-label="Free players per half hour"
              >
                <thead>
                  <tr>
                    <th className="w-12" />
                    {days.map((day) => (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "px-0.5 py-1.5 text-center font-semibold",
                          day.getTime() === today.getTime()
                            ? "text-green-700"
                            : "text-slate-700",
                        )}
                      >
                        <span className="block font-normal text-slate-500">
                          {day.toLocaleDateString([], { weekday: "short" })}
                        </span>
                        {day.getDate()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((rowStart, rowIndex) => (
                    <tr key={rowStart.toISOString()}>
                      <th className="pr-1 text-right align-top font-normal tabular-nums text-slate-400">
                        {rowStart.getMinutes() === 0
                          ? formatTime(rowStart.toISOString())
                          : ""}
                      </th>
                      {grid.map((column, dayIndex) => {
                        const cell = column[rowIndex];
                        const chosen = isSelectedCell(cell.start);
                        return (
                          <td key={dayIndex} className="p-px">
                            <button
                              type="button"
                              disabled={cell.past}
                              onClick={() => {
                                setSelected(cell.start);
                                setConflicts([]);
                              }}
                              title={`${windowLabel(cell)}: ${cell.free} of ${cell.total} free`}
                              aria-label={`${windowLabel(cell)}: ${cell.free} of ${cell.total} free`}
                              className={cn(
                                "relative block h-[18px] w-full rounded-sm pointer-coarse:h-6",
                                heatClass(cell),
                                chosen &&
                                  "outline outline-2 -outline-offset-1 outline-slate-900",
                                !cell.past && "hover:brightness-95",
                              )}
                            >
                              {cell.coachBusy && !cell.past ? (
                                <span
                                  className="absolute right-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-slate-800"
                                  aria-hidden
                                />
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-2 py-1.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  all free
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-300" />
                  ¾+
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-200" />
                  half
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-orange-300" />
                  few
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-300" />
                  nobody
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-800" />
                  you have a session
                </span>
                <span className="ml-auto">{STEP_MINUTES}-min steps</span>
              </div>
            </div>

            <aside className="rounded-xl border bg-slate-50 p-3 text-sm">
              {!selection ? (
                <p className="text-slate-500">
                  Tap a suggestion or a time in the grid to see who can come and
                  to plan it.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {windowLabel(selection)}
                    </p>
                    <p
                      className={cn(
                        "text-sm",
                        selection.free === selection.total
                          ? "text-emerald-700"
                          : "text-amber-800",
                      )}
                    >
                      {selection.free === selection.total
                        ? `All ${selection.total} players are free`
                        : `${selection.free} of ${selection.total} players are free`}
                    </p>
                    {selection.coachBusy ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-700">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        You have another session then.
                      </p>
                    ) : null}
                    {selection.past ? (
                      <p className="mt-1 text-xs text-rose-700">
                        This time is in the past.
                      </p>
                    ) : null}
                  </div>
                  {selection.blockers.length > 0 ? (
                    <ul className="max-h-40 space-y-1 overflow-y-auto">
                      {selection.blockers.map((blocker) => (
                        <li key={blocker.playerId} className="text-xs">
                          <span className="font-medium text-slate-800">
                            {blocker.name}
                          </span>
                          <span className="text-slate-500">
                            {" "}
                            – {blocker.reasons.join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="space-y-1.5 border-t pt-3">
                    <Label htmlFor="tf-title" className="block text-xs">
                      Title
                    </Label>
                    <Input
                      id="tf-title"
                      value={title}
                      maxLength={120}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </div>
                  {conflicts.length > 0 ? (
                    <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                      <p className="font-semibold">
                        Some players are not available
                      </p>
                      <ul className="list-disc pl-4">
                        {conflicts.slice(0, 4).map((conflict) => (
                          <li key={conflict}>{conflict}</li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={creating}
                        onClick={() => void createTraining(true)}
                      >
                        Create anyway
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <Button
                      disabled={creating || selection.past}
                      onClick={() => void createTraining(false)}
                      className="pointer-coarse:h-11"
                    >
                      <CalendarPlus className="mr-1 h-4 w-4" />
                      {creating ? "Creating…" : "Create training"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={selection.past}
                      onClick={() => onPlanEvent(teamId, selection)}
                      className="pointer-coarse:h-11"
                    >
                      <Megaphone className="mr-1 h-4 w-4" />
                      Team event…
                    </Button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
