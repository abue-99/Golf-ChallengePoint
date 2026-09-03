"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { StandaloneAssignment } from "@/types/standalone-assignment";
import { FOCUS_AREA_EMOJI } from "@/lib/lesson-types";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  CheckCircle,
  ClipboardList,
  Clock,
  Inbox,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function QueueItem({
  assignment,
  onStatusChange,
  onJourneyAccept,
  onJourneyKeepInQueue,
}: {
  assignment: StandaloneAssignment;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onJourneyAccept: (id: string) => Promise<void>;
  onJourneyKeepInQueue: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const isJourney = assignment.itemType === "journey";
  const isTeam =
    assignment.sourceType === "TEAM" ||
    assignment.targetType === "TEAM" ||
    Boolean(assignment.teamId);

  async function act(status: string) {
    setBusy(true);
    try {
      await onStatusChange(assignment.id, status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm">
      {/* Status icon */}
      <button
        type="button"
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary"
        onClick={() => act(assignment.status === "COMPLETED" ? "OPEN" : "COMPLETED")}
        title="Toggle complete"
        disabled={busy}
      >
        {assignment.status === "COMPLETED" ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <Square className="h-5 w-5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={cn(
              "font-medium text-sm",
              assignment.status === "COMPLETED" && "line-through text-muted-foreground",
            )}
          >
            {isJourney
              ? assignment.journeyTemplate?.name ?? "Journey"
              : assignment.lesson?.name ?? "—"}
          </p>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 shrink-0",
              isTeam
                ? "border-green-500 text-green-700 dark:text-green-400"
                : "border-blue-500 text-blue-700 dark:text-blue-400",
            )}
          >
            {isTeam ? "TEAM" : "PERSONAL"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 shrink-0",
              isJourney
                ? "border-violet-500 text-violet-700 dark:text-violet-400"
                : "border-blue-500 text-blue-700 dark:text-blue-400",
            )}
          >
            {isJourney
              ? "🛣️ NEW Journey"
              : assignment.isNew
                ? "NEW Lesson"
                : "Lesson"}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {!isJourney && assignment.lesson?.focusArea && (
            <span className="text-xs text-muted-foreground">
              {FOCUS_AREA_EMOJI[assignment.lesson.focusArea] ?? ""}{" "}
              {assignment.lesson.focusArea.replace(/_/g, " ")}
            </span>
          )}
          {!isJourney && assignment.lesson?.durationMinutes && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {assignment.lesson.durationMinutes}m
            </span>
          )}
          {isJourney && assignment.journeyTemplate?.category && (
            <span className="text-xs text-muted-foreground">
              {assignment.journeyTemplate.category}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {STATUS_LABELS[assignment.status] ?? assignment.status}
          </span>
        </div>
      </div>

      {/* Secondary actions */}
      {!isTeam && !isJourney && assignment.status !== "COMPLETED" && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild title="Schedule">
          <a href="/calendar">
            <CalendarPlus className="h-4 w-4" />
          </a>
        </Button>
      )}
      {isJourney && assignment.status !== "COMPLETED" && (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <a href="/player">Open Journey</a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onJourneyAccept(assignment.id);
              } finally {
                setBusy(false);
              }
            }}
          >
            Add To My Journeys
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onJourneyKeepInQueue(assignment.id);
              } finally {
                setBusy(false);
              }
            }}
          >
            Keep In Queue
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TrainingQueuePage() {
  const [assignments, setAssignments] = useState<StandaloneAssignment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "completed">("active");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listMyStandaloneAssignments({ queueOnly: true });
      setAssignments(Array.isArray(data) ? (data as StandaloneAssignment[]) : []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = useCallback(
    async (id: string, status: string) => {
      try {
        await api.updateStandaloneAssignment(id, { status });
        toast.success(
          status === "COMPLETED" ? "Marked as completed." : "Marked as open.",
        );

        const handleJourneyAccept = useCallback(
          async (id: string) => {
            try {
              await api.updateJourneyAssignment(id, {
                status: "OPEN",
                isInTrainingQueue: false,
              });
              toast.success("Journey added to My Journeys.");
              load();
            } catch {
              toast.error("Failed to accept journey.");
            }
          },
          [load],
        );

        const handleJourneyKeepInQueue = useCallback(
          async (id: string) => {
            try {
              await api.updateJourneyAssignment(id, {
                status: "NEW",
                isInTrainingQueue: true,
              });
              toast.success("Journey kept in queue.");
              load();
            } catch {
              toast.error("Failed to update journey.");
            }
          },
          [load],
        );
        load();
      } catch {
        toast.error("Failed to update status.");
      }
    },
    [load],
  );

  const visible = (assignments ?? []).filter((a) => {
    if (filter === "completed") return a.status === "COMPLETED";
    return a.status !== "COMPLETED" && a.status !== "ARCHIVED";
  });

  return (
    <section className="space-y-4 max-w-2xl">
      {/* Header */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            My Training Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Your personal training backlog — practice at your own pace.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/calendar">
            <CalendarPlus className="h-4 w-4 mr-1.5" />
            Schedule a session
          </a>
        </Button>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b pb-0">
        {(["active", "completed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={cn(
              "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              filter === f
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setFilter(f)}
          >
            {f === "active" ? "Active" : "Completed"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading queue…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Inbox className="h-8 w-8 opacity-30" />
          <p className="text-sm">
            {filter === "completed"
              ? "No completed lessons yet."
              : "Your queue is empty. Your coach will assign lessons here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((a) => (
            <QueueItem
              key={a.id}
              assignment={a}
              onStatusChange={handleStatusChange}
              onJourneyAccept={handleJourneyAccept}
              onJourneyKeepInQueue={handleJourneyKeepInQueue}
            />
          ))}
        </div>
      )}
    </section>
  );
}
