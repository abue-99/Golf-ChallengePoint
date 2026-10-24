"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  createTeamEvent,
  deleteTeamEvent,
  updateTeamEvent,
  type TeamEventRecord,
} from "@/lib/coach-calendar";
import type { CoachCalendarTeam } from "@/types/coach-calendar";
import { localDayKey } from "./shared";

export type TeamEventDraft = {
  /** Set when editing an existing event. */
  id?: string;
  teamId: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
};

function timeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function combine(day: string, time: string) {
  return new Date(`${day}T${time}:00`);
}

/** Create or edit a team event (match, meeting, trip …). */
export default function TeamEventDialog({
  draft,
  teams,
  onClose,
  onSaved,
}: {
  /** null = closed. Remount (key) per opening so the form starts fresh. */
  draft: TeamEventDraft | null;
  teams: CoachCalendarTeam[];
  onClose: () => void;
  onSaved: (
    event: TeamEventRecord | null,
    action: "created" | "updated" | "deleted",
  ) => void;
}) {
  const editing = Boolean(draft?.id);
  const [teamId, setTeamId] = useState(draft?.teamId ?? teams[0]?.id ?? "");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [day, setDay] = useState(draft ? localDayKey(draft.start) : "");
  const [startTime, setStartTime] = useState(
    draft ? timeValue(draft.start) : "18:00",
  );
  const [endTime, setEndTime] = useState(
    draft ? timeValue(draft.end) : "19:30",
  );
  const [location, setLocation] = useState(draft?.location ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const start = day && startTime ? combine(day, startTime) : null;
  const end = day && endTime ? combine(day, endTime) : null;
  const invalidRange = Boolean(start && end && end <= start);
  const timeChanged = Boolean(
    draft?.id &&
    start &&
    end &&
    (start.getTime() !== draft.start.getTime() ||
      end.getTime() !== draft.end.getTime()),
  );

  const save = async (force = false) => {
    if (!start || !end || !title.trim() || !teamId) {
      setError("Team, title, date and time are required.");
      return;
    }
    if (invalidRange) {
      setError("The end must be after the start.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        teamId,
        title: title.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        force,
      };
      const saved = draft?.id
        ? await updateTeamEvent(draft.id, payload)
        : await createTeamEvent(payload);
      setConflicts([]);
      onSaved(saved, draft?.id ? "updated" : "created");
      if (saved.answersReset) {
        toast.info(
          `New time – ${saved.answersReset} earlier ${saved.answersReset === 1 ? "answer was" : "answers were"} reset.`,
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflicts(err.conflicts.length ? err.conflicts : [err.message]);
      } else {
        setError(
          err instanceof Error ? err.message : "The event could not be saved.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      await deleteTeamEvent(draft.id);
      onSaved(null, "deleted");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The event could not be deleted.",
      );
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
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit team event" : "New team event"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save(false);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="te-team">Team</Label>
            <select
              id="te-team"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60 pointer-coarse:h-11"
              value={teamId}
              disabled={editing}
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
            <Label htmlFor="te-title">Title</Label>
            <Input
              id="te-title"
              value={title}
              maxLength={120}
              placeholder="e.g. Club match, team meeting"
              onChange={(event) => setTitle(event.target.value)}
              autoFocus={!editing}
            />
          </div>
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="te-day">Date</Label>
              <Input
                id="te-day"
                type="date"
                value={day}
                onChange={(event) => {
                  setDay(event.target.value);
                  setConflicts([]);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="te-start">From</Label>
              <Input
                id="te-start"
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setConflicts([]);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="te-end">To</Label>
              <Input
                id="te-end"
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
          <div className="space-y-1.5">
            <Label htmlFor="te-location">Location (optional)</Label>
            <Input
              id="te-location"
              value={location}
              maxLength={200}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="te-description">
              Notes for the players (optional)
            </Label>
            <Textarea
              id="te-description"
              rows={3}
              value={description}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {timeChanged ? (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
              Changing the time resets the players&apos; answers – they will be
              asked again.
            </p>
          ) : null}

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
                Save anyway
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            {editing ? (
              confirmDelete ? (
                <span className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={saving}
                    onClick={() => void remove()}
                  >
                    Delete event
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep
                  </Button>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-rose-700"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              )
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || invalidRange}>
                {saving ? "Saving…" : editing ? "Save" : "Create event"}
              </Button>
            </span>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
