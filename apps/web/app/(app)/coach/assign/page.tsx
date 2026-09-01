"use client";

import { useCallback, useEffect, useState } from "react";
import { DndLessonProvider } from "@/components/DndLessonProvider";
import LessonLibrarySidebar from "@/components/LessonLibrarySidebar";
import AssignLessonModal from "@/components/AssignLessonModal";
import DroppableZone from "@/components/DroppableZone";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { TrainingLesson } from "@/lib/lesson-types";
import { toast } from "sonner";
import { Users, BookOpen } from "lucide-react";

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
};

function playerName(p: Player) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "—";
}

function playerInitials(p: Player) {
  return `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function CoachAssignPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-assign modal state (for tap/click on mobile)
  const [assignLesson, setAssignLesson] = useState<TrainingLesson | null>(null);
  const [assignPlayerId, setAssignPlayerId] = useState<string | null>(null);
  const [assignTeamId, setAssignTeamId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [defaultAddToQueue, setDefaultAddToQueue] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/players/my").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/teams").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([p, t]) => {
        setPlayers(Array.isArray(p) ? p : []);
        setTeams(Array.isArray(t) ? t : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLessonClick = useCallback((lesson: TrainingLesson) => {
    setAssignLesson(lesson);
    setAssignPlayerId(null);
    setAssignTeamId(null);
    setDefaultAddToQueue(false);
    setAssignModalOpen(true);
  }, []);

  const handleQueueDrop = useCallback((lesson: TrainingLesson) => {
    setAssignLesson(lesson);
    setAssignPlayerId(null);
    setAssignTeamId(null);
    setDefaultAddToQueue(true);
    setAssignModalOpen(true);
  }, []);

  const handleAssigned = useCallback((target: Parameters<NonNullable<React.ComponentProps<typeof DndLessonProvider>["onAssigned"]>>[0]) => {
    if (target.kind === "player") toast.success(`Lesson assigned to ${target.playerName}.`);
    else if (target.kind === "team") toast.success(`Lesson assigned to ${target.teamName}.`);
    else toast.success("Lesson added to Training Queue.");
  }, []);

  return (
    <DndLessonProvider onAssigned={handleAssigned} onQueueDrop={handleQueueDrop}>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Lesson Library Sidebar */}
        <LessonLibrarySidebar onLessonClick={handleLessonClick} />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">Assign Lessons</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Drag a lesson from the sidebar onto a player or team to assign it instantly.
              On touch devices, tap a lesson to open the quick-assign dialog.
            </p>
          </header>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {/* Players drop targets */}
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Players
                </h2>
                {players.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No linked players.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {players.map((player) => (
                      <DroppableZone
                        key={player.id}
                        id={`player:${player.id}:${playerName(player)}`}
                        className="rounded-xl"
                        activeClassName="ring-2 ring-primary ring-offset-1 bg-primary/5 scale-105"
                      >
                        <div
                          className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
                          onClick={() => {
                            setAssignLesson(null);
                            setAssignPlayerId(player.id);
                            setAssignTeamId(null);
                            setAssignModalOpen(true);
                          }}
                          title={`Drop a lesson or tap to assign to ${playerName(player)}`}
                        >
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                              {playerInitials(player)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium text-center leading-snug">
                            {playerName(player)}
                          </span>
                          <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 dark:text-blue-400 px-1.5 py-0">
                            PLAYER
                          </Badge>
                        </div>
                      </DroppableZone>
                    ))}
                  </div>
                )}
              </section>

              {/* Teams drop targets */}
              {teams.length > 0 && (
                <section className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Teams
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {teams.map((team) => (
                      <DroppableZone
                        key={team.id}
                        id={`team:${team.id}:${team.shortName}`}
                        className="rounded-xl"
                        activeClassName="ring-2 ring-green-500 ring-offset-1 bg-green-50 dark:bg-green-950/20"
                      >
                        <div
                          className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
                          onClick={() => {
                            setAssignLesson(null);
                            setAssignPlayerId(null);
                            setAssignTeamId(team.id);
                            setAssignModalOpen(true);
                          }}
                          title={`Drop a lesson or tap to assign to ${team.shortName}`}
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
                            {team.icon ?? "👥"}
                          </div>
                          <span className="text-xs font-medium text-center leading-snug">
                            {team.shortName}
                          </span>
                          <Badge variant="outline" className="text-[10px] border-green-400 text-green-700 dark:text-green-400 px-1.5 py-0">
                            TEAM
                          </Badge>
                        </div>
                      </DroppableZone>
                    ))}
                  </div>
                </section>
              )}

              {/* Training Queue drop target */}
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  Training Queue
                </h2>
                <DroppableZone
                  id="training-queue"
                  className="rounded-xl border-2 border-dashed border-border transition-colors"
                  activeClassName="border-primary bg-primary/5"
                >
                  <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                    <BookOpen className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">Drop here to add to a player&apos;s Training Queue</p>
                    <p className="text-xs opacity-60">The lesson will be added without a scheduled time</p>
                  </div>
                </DroppableZone>
              </section>
            </>
          )}
        </main>
      </div>

      {/* Quick-assign modal for tap/click */}
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
        onAssigned={() => {
          toast.success("Lesson assigned successfully.");
          setAssignModalOpen(false);
        }}
      />
    </DndLessonProvider>
  );
}
