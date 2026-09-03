"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { StandaloneAssignment } from "@/types/standalone-assignment";
import { FOCUS_AREA_EMOJI } from "@/lib/lesson-types";
import { cn } from "@/lib/utils";
import { CalendarPlus, CheckCircle, ClipboardList, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";


function AssignmentCard({
  assignment,
  onMoveToQueue,
  onMarkOpen,
  onAcceptJourney,
}: {
  assignment: StandaloneAssignment;
  onMoveToQueue: (id: string) => Promise<void>;
  onMarkOpen: (id: string) => Promise<void>;
  onAcceptJourney: (id: string) => Promise<void>;
}) {
  const isJourney = assignment.itemType === "journey";
  const isTeam = assignment.targetType === "TEAM";
  const [busy, setBusy] = useState(false);

  async function handleAction(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        isTeam
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
          : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
      )}
    >
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 font-semibold uppercase",
            isTeam
              ? "border-green-500 text-green-700 dark:text-green-400"
              : "border-blue-500 text-blue-700 dark:text-blue-400",
          )}
        >
          {isTeam ? "TEAM" : "PERSONAL"}
        </Badge>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          {isJourney ? "NEW JOURNEY" : "NEW"}
        </span>
      </div>

      {/* Lesson info */}
      <div>
        <p className="font-semibold text-sm leading-snug">
          {isJourney
            ? assignment.journeyTemplate?.name ?? "Journey"
            : assignment.lesson?.name ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {!isJourney && assignment.lesson?.focusArea
            ? (FOCUS_AREA_EMOJI[assignment.lesson.focusArea] ?? "") +
              " " +
              assignment.lesson.focusArea.replace(/_/g, " ")
            : null}
          {isJourney && assignment.journeyTemplate?.category
            ? assignment.journeyTemplate.category
            : null}
          {isTeam && assignment.team
            ? ` · ${assignment.team.shortName}`
            : null}
        </p>
      </div>

      {/* Actions */}
      {!isTeam && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {!isJourney && !assignment.isInTrainingQueue && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={busy}
              onClick={() => handleAction(() => onMoveToQueue(assignment.id))}
            >
              <ClipboardList className="h-3 w-3" />
              Add to Queue
            </Button>
          )}
          {isJourney ? (
            <>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <a href="/player">Open Journey</a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={busy}
                onClick={() => handleAction(() => onAcceptJourney(assignment.id))}
              >
                <CheckCircle className="h-3 w-3" />
                Add To My Journeys
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={busy}
                onClick={() => handleAction(() => onMarkOpen(assignment.id))}
              >
                <CheckCircle className="h-3 w-3" />
                Acknowledge
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <a href="/calendar">
                  <CalendarPlus className="h-3 w-3" />
                  Schedule
                </a>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewAssignmentsSection() {
  const [assignments, setAssignments] = useState<StandaloneAssignment[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.listMyStandaloneAssignments({ status: "NEW" });
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

  const handleMoveToQueue = useCallback(
    async (id: string) => {
      try {
        await api.moveStandaloneAssignmentToQueue(id);
        toast.success("Added to Training Queue.");
        load();
      } catch {
        toast.error("Failed to move to queue.");
      }
    },
    [load],
  );

  const handleMarkOpen = useCallback(
    async (id: string) => {
      try {
        await api.updateStandaloneAssignment(id, { status: "OPEN" });
        toast.success("Assignment acknowledged.");
        load();
      } catch {
        toast.error("Failed to update assignment.");
      }
    },
    [load],
  );

  const handleAcceptJourney = useCallback(
    async (id: string) => {
      try {
        await api.updateJourneyAssignment(id, {
          status: "OPEN",
          isInTrainingQueue: false,
        });
        toast.success("Journey added to My Journeys.");
        load();
      } catch {
        toast.error("Failed to update journey.");
      }
    },
    [load],
  );

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Loading assignments…
      </div>
    );
  }

  if (!assignments || assignments.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Inbox className="h-4 w-4" />
        New Assignments
      </h3>
      <div className="space-y-2">
        {assignments.map((a) => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            onMoveToQueue={handleMoveToQueue}
            onMarkOpen={handleMarkOpen}
            onAcceptJourney={handleAcceptJourney}
          />
        ))}
      </div>
    </section>
  );
}
