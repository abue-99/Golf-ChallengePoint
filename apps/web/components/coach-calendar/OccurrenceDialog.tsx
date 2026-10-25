"use client";

import { useState } from "react";
import { AlertTriangle, CalendarX2, MoveRight, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  changeOccurrence,
  type OccurrenceChangeResult,
} from "@/lib/coach-calendar";
import type { CoachCalendarActivity } from "@/types/coach-calendar";
import { formatRange, localDayKey } from "./shared";

export type OccurrenceAction = "move" | "cancel" | "restore";

export type OccurrenceDraft = {
  activity: CoachCalendarActivity;
  action: OccurrenceAction;
  /** Proposed new time (drag & drop); defaults to the current time. */
  start?: Date;
  end?: Date;
};

function timeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function combine(day: string, time: string) {
  return new Date(`${day}T${time}:00`);
}

const TITLE: Record<OccurrenceAction, string> = {
  move: "Move this date",
  cancel: "Cancel this date",
  restore: "Back to the usual time",
};

/**
 * Moves, cancels or restores one date of a team training. The rest of the
 * series stays; the players' answers for this date are reset and they get
 * an e-mail.
 */
export default function OccurrenceDialog({
  draft,
  onClose,
  onDone,
}: {
  /** null = closed. Remount (key) per opening so the form starts fresh. */
  draft: OccurrenceDraft | null;
  onClose: () => void;
  onDone: (result: OccurrenceChangeResult, action: OccurrenceAction) => void;
}) {
  const activity = draft?.activity;
  const action = draft?.action ?? "move";
  const initialStart = draft?.start ?? new Date(activity?.start ?? Date.now());
  const initialEnd = draft?.end ?? new Date(activity?.end ?? Date.now());
  const [day, setDay] = useState(localDayKey(initialStart));
  const [startTime, setStartTime] = useState(timeValue(initialStart));
  const [endTime, setEndTime] = useState(timeValue(initialEnd));
  const [reason, setReason] = useState(
    action === "restore" ? "" : (activity?.changeReason ?? ""),
  );
  const [notify, setNotify] = useState(true);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const start = day && startTime ? combine(day, startTime) : null;
  const end = day && endTime ? combine(day, endTime) : null;
  const invalidRange = Boolean(start && end && end <= start);
  const isSeries = Boolean(
    activity?.recurrence && activity.recurrence !== "NONE",
  );
  const answered = activity?.attendance
    ? activity.attendance.going +
      activity.attendance.maybe +
      activity.attendance.notGoing
    : 0;
  const members = activity?.attendance?.members ?? 0;

  const submit = async (force = false) => {
    if (!activity?.occurrenceKey) return;
    if (action === "move" && (!start || !end || invalidRange)) {
      setError("Pick a date and a time where the end is after the start.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await changeOccurrence({
        occurrenceKey: activity.occurrenceKey,
        action,
        start: action === "move" ? (start ?? undefined) : undefined,
        end: action === "move" ? (end ?? undefined) : undefined,
        reason: action === "restore" ? null : reason.trim() || null,
        notify,
        force,
      });
      setConflicts([]);
      onDone(result, action);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflicts(err.conflicts.length ? err.conflicts : [err.message]);
      } else {
        setError(
          err instanceof Error ? err.message : "The change could not be saved.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={Boolean(draft)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        {activity ? (
          <>
            <DialogHeader>
              <DialogTitle>{TITLE[action]}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(false);
              }}
            >
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-slate-800">
                  {activity.title}
                  {activity.teamName ? ` · ${activity.teamName}` : ""}
                </p>
                <p className="text-slate-600">
                  {action === "restore" && activity.originalStart
                    ? `${formatRange(activity.start, activity.end)} → ${formatRange(
                        activity.originalStart,
                        activity.originalEnd ?? activity.originalStart,
                      )}`
                    : formatRange(activity.start, activity.end)}
                </p>
                {isSeries ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Only this date changes – the rest of the series stays as it
                    is.
                  </p>
                ) : null}
              </div>

              {action === "move" ? (
                <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="oc-day">New date</Label>
                    <Input
                      id="oc-day"
                      type="date"
                      value={day}
                      onChange={(event) => {
                        setDay(event.target.value);
                        setConflicts([]);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="oc-start">From</Label>
                    <Input
                      id="oc-start"
                      type="time"
                      value={startTime}
                      onChange={(event) => {
                        setStartTime(event.target.value);
                        setConflicts([]);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="oc-end">To</Label>
                    <Input
                      id="oc-end"
                      type="time"
                      value={endTime}
                      aria-invalid={invalidRange}
                      onChange={(event) => {
                        setEndTime(event.target.value);
                        setConflicts([]);
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {action !== "restore" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="oc-reason">
                    Note for the players (optional)
                  </Label>
                  <Textarea
                    id="oc-reason"
                    rows={2}
                    maxLength={300}
                    value={reason}
                    placeholder={
                      action === "cancel"
                        ? "e.g. Course closed after the storm"
                        : "e.g. Range is booked on Tuesday"
                    }
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
              ) : null}

              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
                {action === "cancel"
                  ? "The players' answers and reminders for this date are removed. Planned lessons stay and come back if you restore the date."
                  : "The players' answers for this date are reset – they will be asked again. Planned lessons move along."}
                {answered > 0
                  ? ` ${answered} of ${members} ${members === 1 ? "player has" : "players have"} answered so far.`
                  : ""}
              </p>

              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-700 pointer-coarse:min-h-11">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-green-600 pointer-coarse:h-5 pointer-coarse:w-5"
                  checked={notify}
                  onChange={(event) => setNotify(event.target.checked)}
                />
                Email the players about the change
              </label>

              {conflicts.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4" /> Some players are not
                    available
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">
                    {conflicts.map((conflict) => (
                      <li key={conflict}>{conflict}</li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void submit(true)}
                  >
                    Move anyway
                  </Button>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button
                  type="submit"
                  variant={action === "cancel" ? "destructive" : "default"}
                  disabled={saving || (action === "move" && invalidRange)}
                >
                  {action === "cancel" ? (
                    <CalendarX2 className="mr-1 h-4 w-4" />
                  ) : action === "move" ? (
                    <MoveRight className="mr-1 h-4 w-4" />
                  ) : (
                    <Undo2 className="mr-1 h-4 w-4" />
                  )}
                  {saving
                    ? "Saving…"
                    : action === "cancel"
                      ? "Cancel this date"
                      : action === "move"
                        ? "Move"
                        : "Restore"}
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
