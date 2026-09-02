"use client";

import { useCallback, useMemo, useState } from "react";
import { DndLessonProvider } from "@/components/DndLessonProvider";
import LessonLibrarySidebar from "@/components/LessonLibrarySidebar";
import AssignLessonModal from "@/components/AssignLessonModal";
import DroppableZone from "@/components/DroppableZone";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TrainingLesson } from "@/lib/lesson-types";
import { api } from "@/lib/api";
import { trackCoachTelemetry } from "@/lib/telemetry";
import { BookOpen, Users } from "lucide-react";
import { toast } from "sonner";

type Player = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string;
};

type Team = {
  id: string;
  shortName: string;
  icon: string | null;
  members: { userId: string }[];
};

type Props = {
  players: Player[];
  teams: Team[];
  playerQueueById: Record<string, number>;
  teamPendingById: Record<string, number>;
  onAssigned?: () => void;
};

function playerName(p: Player) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "—";
}

function playerInitials(p: Player) {
  return `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function CoachWorkspaceAssignmentPanel({
  players,
  teams,
  playerQueueById,
  teamPendingById,
  onAssigned,
}: Props) {
  const [assignLesson, setAssignLesson] = useState<TrainingLesson | null>(null);
  const [assignPlayerId, setAssignPlayerId] = useState<string | null>(null);
  const [assignTeamId, setAssignTeamId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [defaultAddToQueue, setDefaultAddToQueue] = useState(false);
  const [announce, setAnnounce] = useState("");

  const teamSizeById = useMemo(
    () => Object.fromEntries(teams.map((team) => [team.id, team.members.length])),
    [teams],
  );

  const refreshWorkspace = useCallback(() => {
    onAssigned?.();
  }, [onAssigned]);

  const undoAssignments = useCallback(async (assignmentIds: string[]) => {
    await Promise.all(
      assignmentIds.map((id) =>
        api.updateStandaloneAssignment(id, { status: "ARCHIVED" }),
      ),
    );
    trackCoachTelemetry("LessonAssignmentUndone", { assignmentCount: assignmentIds.length });
    toast.success("Assignment undone.");
    refreshWorkspace();
  }, [refreshWorkspace]);

  const showUndoToast = useCallback((assignmentIds: string[]) => {
    if (assignmentIds.length === 0) return;
    toast.success("Lesson assigned.", {
      duration: 10_000,
      action: {
        label: "Undo",
        onClick: () => {
          undoAssignments(assignmentIds).catch(() => {
            toast.error("Failed to undo assignment.");
          });
        },
      },
    });
  }, [undoAssignments]);

  const handleLessonClick = useCallback((lesson: TrainingLesson) => {
    setAssignLesson(lesson);
    setAssignPlayerId(null);
    setAssignTeamId(null);
    setDefaultAddToQueue(false);
    setAssignModalOpen(true);
    setAnnounce(`Lesson selected: ${lesson.name}`);
  }, []);

  const handleQueueDrop = useCallback((lesson: TrainingLesson) => {
    setAssignLesson(lesson);
    setAssignPlayerId(null);
    setAssignTeamId(null);
    setDefaultAddToQueue(true);
    setAssignModalOpen(true);
  }, []);

  const handleAssigned = useCallback(
    (target: { kind: "player" | "team" | "queue"; playerName?: string; teamName?: string }, result?: unknown) => {
      refreshWorkspace();

      const assignmentIds =
        typeof result === "object" && result && "assignments" in result
          ? ((result as { assignments?: { id: string }[] }).assignments ?? []).map((a) => a.id)
          : typeof result === "object" && result && "id" in result
            ? [String((result as { id?: string }).id)]
            : [];
      showUndoToast(assignmentIds);

      if (target.kind === "player") {
        setAnnounce(`Assigned lesson to ${target.playerName ?? "player"}`);
      } else if (target.kind === "team") {
        setAnnounce(`Assigned lesson to ${target.teamName ?? "team"}`);
      }
    },
    [refreshWorkspace, showUndoToast],
  );

  return (
    <DndLessonProvider onAssigned={handleAssigned} onQueueDrop={handleQueueDrop}>
      <section className="grid gap-4 lg:grid-cols-[65fr_35fr]">
        <div className="space-y-4 order-1">
          <header>
            <h2 className="text-lg font-semibold tracking-tight">Teams & Players Workspace</h2>
            <p className="text-sm text-muted-foreground">
              Drag a lesson onto a team or player. On touch, tap a lesson for quick assign.
            </p>
            <p aria-live="polite" className="sr-only">{announce}</p>
          </header>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-4 w-4" /> Teams
            </h3>
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {teams.map((team) => {
                  const affected = teamSizeById[team.id] ?? 0;
                  return (
                    <DroppableZone
                      key={team.id}
                      id={`team:${team.id}:${team.shortName}`}
                      className="rounded-xl"
                      activeClassName="ring-2 ring-green-500 ring-offset-1 bg-green-50 dark:bg-green-950/20"
                    >
                      {({ isOver }) => (
                        <button
                          type="button"
                          onClick={() => {
                            setAssignLesson(null);
                            setAssignPlayerId(null);
                            setAssignTeamId(team.id);
                            setAssignModalOpen(true);
                          }}
                          className="w-full rounded-xl border bg-card p-3 text-left"
                          aria-label={`Assign lesson to team ${team.shortName}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{team.shortName}</span>
                            <Badge variant="outline" className="text-[10px]">Pending {teamPendingById[team.id] ?? 0}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isOver ? `Assign to ${team.shortName} • ${affected} players` : `${affected} players`}
                          </p>
                        </button>
                      )}
                    </DroppableZone>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-4 w-4" /> Players
            </h3>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked players.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {players.map((player) => (
                  <DroppableZone
                    key={player.id}
                    id={`player:${player.id}:${playerName(player)}`}
                    className="rounded-xl"
                    activeClassName="ring-2 ring-primary ring-offset-1 bg-primary/5"
                  >
                    {({ isOver }) => (
                      <button
                        type="button"
                        className="w-full rounded-xl border bg-card p-3 text-left"
                        onClick={() => {
                          setAssignLesson(null);
                          setAssignPlayerId(player.id);
                          setAssignTeamId(null);
                          setAssignModalOpen(true);
                        }}
                        aria-label={`Assign lesson to ${playerName(player)}`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{playerInitials(player)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{playerName(player)}</p>
                            <p className="text-xs text-muted-foreground">
                              {isOver ? `Assign to ${playerName(player)}` : `Queue: ${playerQueueById[player.id] ?? 0}`}
                            </p>
                          </div>
                        </div>
                      </button>
                    )}
                  </DroppableZone>
                ))}
              </div>
            )}
          </section>

          <section>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setAssignLesson(null);
                setAssignPlayerId(null);
                setAssignTeamId(null);
                setDefaultAddToQueue(true);
                setAssignModalOpen(true);
              }}
            >
              <BookOpen className="h-4 w-4" />
              Keyboard / Tap Assign
            </Button>
          </section>
        </div>

        <div className="order-2 h-[520px] lg:h-[640px] border rounded-xl overflow-hidden">
          <LessonLibrarySidebar onLessonClick={handleLessonClick} inlineFullWidth />
        </div>
      </section>

      <AssignLessonModal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setAssignLesson(null);
          setAssignPlayerId(null);
          setAssignTeamId(null);
          setDefaultAddToQueue(false);
        }}
        preselectedLesson={assignLesson}
        preselectedPlayerId={assignPlayerId}
        preselectedTeamId={assignTeamId}
        defaultAddToQueue={defaultAddToQueue}
        onAssigned={(result) => {
          handleAssigned(
            assignPlayerId
              ? { kind: "player", playerName: playerName(players.find((p) => p.id === assignPlayerId) ?? { id: "", firstName: "Player", lastName: "", email: "" }) }
              : assignTeamId
                ? { kind: "team", teamName: teams.find((t) => t.id === assignTeamId)?.shortName ?? "team" }
                : { kind: "queue" },
            result,
          );
          setAssignModalOpen(false);
        }}
      />
    </DndLessonProvider>
  );
}
