"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  createOneTimeTraining,
  deleteTraining,
  planLessonInTraining,
} from "@/lib/coach-calendar";
import type { CoachCalendarTeam } from "@/types/coach-calendar";
import { lessonMeta, type PlannableLesson } from "./LessonLibrary";
import { localDayKey } from "./shared";

export type PlanDraft = { lesson: PlannableLesson; start: Date };

export type PlannedResult = { slotId: string; taskIds: string[]; start: Date };

function timeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * A lesson dropped on a free time: creates a one-time team training with the
 * lesson in it. Players of the team are asked whether they are coming.
 */
export default function PlanLessonDialog({
  draft,
  teams,
  defaultTeamId,
  onClose,
  onPlanned,
}: {
  draft: PlanDraft | null;
  teams: CoachCalendarTeam[];
  defaultTeamId: string | null;
  onClose: () => void;
  onPlanned: (result: PlannedResult) => void;
}) {
  const [teamId, setTeamId] = useState(defaultTeamId ?? teams[0]?.id ?? "");
  const [title, setTitle] = useState(draft?.lesson.name ?? "");
  const [day, setDay] = useState(draft ? localDayKey(draft.start) : "");
  const [startTime, setStartTime] = useState(
    draft ? timeValue(draft.start) : "17:00",
  );
  const [duration, setDuration] = useState(
    String(draft?.lesson.durationMinutes || 60),
  );
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (force = false) => {
    if (!draft) return;
    const minutes = Number(duration);
    if (!teamId || !day || !startTime || !title.trim()) {
      setError("Team, title, date and time are required.");
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) {
      setError("Duration must be between 5 and 600 minutes.");
      return;
    }
    const start = new Date(`${day}T${startTime}:00`);
    const end = new Date(start.getTime() + minutes * 60_000);
    setSaving(true);
    setError(null);
    let slotId: string | null = null;
    try {
      const slot = await createOneTimeTraining({
        teamId,
        title: title.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        force,
      });
      slotId = slot.id;
      const tasks = await planLessonInTraining({
        slotId: slot.id,
        lesson: draft.lesson,
        start,
        durationMinutes: minutes,
      });
      onPlanned({
        slotId: slot.id,
        taskIds: tasks.map((task) => task.id),
        start,
      });
    } catch (err) {
      // Never leave an empty training behind.
      if (slotId) await deleteTraining(slotId).catch(() => undefined);
      if (err instanceof ApiError && err.status === 409) {
        setConflicts(err.conflicts.length ? err.conflicts : [err.message]);
      } else {
        setError(
          err instanceof Error ? err.message : "Could not plan the lesson.",
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
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan a team training</DialogTitle>
        </DialogHeader>
        {draft ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save(false);
            }}
          >
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
              <span className="font-semibold">{draft.lesson.name}</span>
              <span className="block text-xs text-green-800">
                {lessonMeta(draft.lesson)}
              </span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="pl-team">Team</Label>
              <select
                id="pl-team"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm pointer-coarse:h-11"
                value={teamId}
                onChange={(event) => {
                  setTeamId(event.target.value);
                  setConflicts([]);
                }}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.shortName} ({team.memberCount} players)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-title">Training title</Label>
              <Input
                id="pl-title"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="pl-day">Date</Label>
                <Input
                  id="pl-day"
                  type="date"
                  value={day}
                  onChange={(event) => {
                    setDay(event.target.value);
                    setConflicts([]);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-start">Start</Label>
                <Input
                  id="pl-start"
                  type="time"
                  step={900}
                  value={startTime}
                  onChange={(event) => {
                    setStartTime(event.target.value);
                    setConflicts([]);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-duration">Minutes</Label>
                <Input
                  id="pl-duration"
                  type="number"
                  min={5}
                  max={600}
                  step={5}
                  value={duration}
                  onChange={(event) => {
                    setDuration(event.target.value);
                    setConflicts([]);
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Creates a one-time training with this lesson. The players are
              asked whether they are coming.
            </p>
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
                  onClick={() => void save(true)}
                >
                  Plan anyway
                </Button>
              </div>
            ) : null}
            {error ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Planning…" : "Plan training"}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
