"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  getFocusAreaPath,
  type TrainingLesson,
} from "@/lib/lesson-types";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BookOpen, Search } from "lucide-react";
import { toast } from "sonner";
import { trackCoachTelemetry } from "@/lib/telemetry";

type Player = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string;
};

type Team = {
  id: string;
  shortName: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  preselectedLesson?: TrainingLesson | null;
  preselectedPlayerId?: string | null;
  preselectedTeamId?: string | null;
  defaultAddToQueue?: boolean;
  onAssigned?: (result?: unknown) => void;
};

export default function AssignLessonModal({
  open,
  onClose,
  preselectedLesson,
  preselectedPlayerId,
  preselectedTeamId,
  defaultAddToQueue,
  onAssigned,
}: Props) {
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  const [lessonSearch, setLessonSearch] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [targetType, setTargetType] = useState<"player" | "team">("player");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [addToQueue, setAddToQueue] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    trackCoachTelemetry("QuickAssignOpened", {
      preselectedPlayerId,
      preselectedTeamId,
    });
    api.listLessons().then((data: TrainingLesson[] | unknown) => {
      setLessons(Array.isArray(data) ? data : []);
    });
    fetch("/api/players/my")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Player[] | unknown) => setPlayers(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Team[] | unknown) => setTeams(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [open, preselectedPlayerId, preselectedTeamId]);

  useEffect(() => {
    if (!open) return;
    if (preselectedLesson) setSelectedLessonId(preselectedLesson.id);
    if (preselectedPlayerId) {
      setTargetType("player");
      setSelectedPlayerId(preselectedPlayerId);
    }
    if (preselectedTeamId) {
      setTargetType("team");
      setSelectedTeamId(preselectedTeamId);
    }
    if (defaultAddToQueue) setAddToQueue(true);
  }, [open, preselectedLesson, preselectedPlayerId, preselectedTeamId, defaultAddToQueue]);

  const filteredLessons = useMemo(() => {
    const lower = lessonSearch.toLowerCase();
    return lessons.filter(
      (l) =>
        !lessonSearch ||
        l.name.toLowerCase().includes(lower) ||
        getFocusAreaPath(l.focusArea, l.subCapability).toLowerCase().includes(lower),
    );
  }, [lessons, lessonSearch]);

  function handleClose(markCancelled = true) {
    if (markCancelled) trackCoachTelemetry("LessonAssignmentCancelled");
    setLessonSearch("");
    setSelectedLessonId("");
    setTargetType("player");
    setSelectedPlayerId("");
    setSelectedTeamId("");
    setAddToQueue(false);
    onClose();
  }

  async function handleSubmit() {
    if (!selectedLessonId) return toast.error("Please select a lesson.");
    if (targetType === "player" && !selectedPlayerId) return toast.error("Please select a player.");
    if (targetType === "team" && !selectedTeamId) return toast.error("Please select a team.");

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        lessonId: selectedLessonId,
        isInTrainingQueue: addToQueue,
      };
      const result =
        targetType === "player"
          ? await api.assignLessonToPlayer(selectedPlayerId, payload)
          : await api.assignLessonToTeam(selectedTeamId, payload);
      trackCoachTelemetry("QuickAssignCompleted", {
        targetType,
        lessonId: selectedLessonId,
        playerId: selectedPlayerId || undefined,
        teamId: selectedTeamId || undefined,
      });
      toast.success("Lesson assigned successfully.");
      onAssigned?.(result);
      handleClose(false);
    } catch {
      toast.error("Failed to assign lesson.");
    } finally {
      setSubmitting(false);
    }
  }

  const form = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Lesson</Label>
        <div className="relative mb-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={lessonSearch}
            onChange={(e) => setLessonSearch(e.target.value)}
            placeholder="Search lessons…"
            className="pl-7 h-8 text-sm"
          />
        </div>
        <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select a lesson…" />
          </SelectTrigger>
          <SelectContent className="max-h-56">
            {filteredLessons.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({FOCUS_AREAS.find((f) => f.value === l.focusArea)?.label ?? l.focusArea})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Assign To</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={targetType === "player" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setTargetType("player")}
          >
            Player
          </Button>
          <Button
            type="button"
            variant={targetType === "team" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setTargetType("team")}
          >
            Team
          </Button>
        </div>
      </div>

      {targetType === "player" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Player</Label>
          <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select a player…" />
            </SelectTrigger>
            <SelectContent>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {[p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {targetType === "team" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Team</Label>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select a team…" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={addToQueue}
          onChange={(e) => setAddToQueue(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Also add to Training Queue
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Assigning…" : "Assign Lesson"}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="px-0 pt-0">
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Assign Lesson
            </SheetTitle>
          </SheetHeader>
          {form}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Assign Lesson
            </span>
          </DialogTitle>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
