"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, Loader2, Route as RouteIcon, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { libraryItemName, rememberRecent, type LibraryItem } from "./AssignLibrary";

export type SelectionSummary = {
  teamIds: string[];
  playerIds: string[];
  /** Everybody reached: members of the selected teams plus selected players. */
  peopleIds: Set<string>;
  /** Selected players that are already covered by a selected team. */
  coveredPlayerIds: Set<string>;
  /** People who already have the armed journey open. */
  duplicateIds: Set<string>;
};

type Priority = "LOW" | "MEDIUM" | "HIGH";

type CreatedIds = { lessonAssignmentIds: string[]; planIds: string[] };

function plural(count: number, word: string) {
  if (word === "person") return `${count} ${count === 1 ? "person" : "people"}`;
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

async function undo(ids: CreatedIds) {
  const res = await fetch("/api/coach/roster/undo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as { lessonsRemoved: number; journeysRemoved: number };
}

/**
 * Floating bar while selecting targets: what is armed, who gets it, and the
 * button that assigns it to everybody in one go (with undo).
 */
export default function AssignBar({
  armed,
  summary,
  teamName,
  onClearArmed,
  onCancel,
  onDone,
}: {
  armed: LibraryItem | null;
  summary: SelectionSummary;
  teamName: (teamId: string) => string;
  onClearArmed: () => void;
  onCancel: () => void;
  /** Called after assigning or undoing, so the page can refresh. */
  onDone: () => void;
}) {
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [busy, setBusy] = useState(false);

  const teamCount = summary.teamIds.length;
  const directPlayers = summary.playerIds.filter((id) => !summary.coveredPlayerIds.has(id));
  const duplicatePlayerTargets = directPlayers.filter((id) => summary.duplicateIds.has(id));
  const playerTargets =
    armed?.type === "journey" && skipDuplicates
      ? directPlayers.filter((id) => !summary.duplicateIds.has(id))
      : directPlayers;
  const people = summary.peopleIds.size;
  const hasTargets = teamCount + summary.playerIds.length > 0;
  const duplicatesInTeams = [...summary.duplicateIds].filter((id) => !directPlayers.includes(id)).length;

  const targetText = [
    teamCount ? plural(teamCount, "team") : null,
    summary.playerIds.length ? plural(summary.playerIds.length, "player") : null,
  ]
    .filter(Boolean)
    .join(" + ");

  async function assign() {
    if (!armed || (!teamCount && playerTargets.length === 0)) return;
    setBusy(true);
    const created: CreatedIds = { lessonAssignmentIds: [], planIds: [] };
    let failed = 0;

    const jobs: (() => Promise<void>)[] = [];
    if (armed.type === "lesson") {
      const payload: Record<string, unknown> = { lessonId: armed.lesson.id, priority };
      if (dueDate) payload.dueDate = new Date(`${dueDate}T12:00:00`).toISOString();
      summary.teamIds.forEach((teamId) =>
        jobs.push(async () => {
          // Team lessons fan out into one assignment per member.
          const result = (await api.assignLessonToTeam(teamId, payload)) as {
            id?: string;
            assignments?: { id?: string }[];
          };
          (result?.assignments ?? []).forEach((entry) => {
            if (entry.id) created.lessonAssignmentIds.push(entry.id);
          });
          if (result?.id) created.lessonAssignmentIds.push(result.id);
        }),
      );
      playerTargets.forEach((playerId) =>
        jobs.push(async () => {
          const result = (await api.assignLessonToPlayer(playerId, payload)) as { id?: string };
          if (result?.id) created.lessonAssignmentIds.push(result.id);
        }),
      );
    } else {
      summary.teamIds.forEach((teamId) =>
        jobs.push(async () => {
          const result = (await api.assignJourneyToTeam(armed.journey.id, teamId)) as {
            assignments?: { playerPlanId?: string }[];
          };
          (result?.assignments ?? []).forEach((entry) => {
            if (entry.playerPlanId) created.planIds.push(entry.playerPlanId);
          });
        }),
      );
      playerTargets.forEach((playerId) =>
        jobs.push(async () => {
          const result = (await api.assignJourneyToPlayer(armed.journey.id, playerId)) as {
            playerPlanId?: string;
          };
          if (result?.playerPlanId) created.planIds.push(result.playerPlanId);
        }),
      );
    }

    // One request at a time keeps the API and the queues predictable.
    for (const job of jobs) {
      try {
        await job();
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    rememberRecent(armed);
    onDone();

    const name = libraryItemName(armed);
    const succeeded = jobs.length - failed;
    if (succeeded === 0) {
      toast.error(`Could not assign “${name}”.`);
      return;
    }
    const who =
      teamCount === 1 && playerTargets.length === 0
        ? teamName(summary.teamIds[0])
        : plural(people - (armed.type === "journey" && skipDuplicates ? duplicatePlayerTargets.length : 0), "person");
    toast.success(`“${name}” assigned to ${who}.`, {
      description: failed ? `${failed} of ${jobs.length} assignments failed.` : undefined,
      duration: 10000,
      action: {
        label: "Undo",
        onClick: () => {
          undo(created)
            .then((result) => {
              const removed = result.lessonsRemoved + result.journeysRemoved;
              toast.success(removed ? "Assignment undone." : "Nothing to undo any more.");
              onDone();
            })
            .catch(() => toast.error("Undo failed."));
        },
      },
    });
  }

  const ArmedIcon = armed?.type === "journey" ? RouteIcon : BookOpen;

  return (
    <div
      className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-height)+0.75rem)] z-40 mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:bottom-5"
      role="region"
      aria-label="Assign to selection"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {armed ? (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-green-50 py-1 pl-2.5 pr-1 text-sm font-medium text-green-900">
            <ArmedIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{libraryItemName(armed)}</span>
            <button
              type="button"
              onClick={onClearArmed}
              className="rounded-full p-0.5 hover:bg-green-100 pointer-coarse:p-1.5"
              aria-label="Clear selected lesson or journey"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <span className="text-sm text-slate-600">Pick a lesson or journey in the library</span>
        )}

        <span className="text-sm text-slate-600">
          {hasTargets ? (
            <>
              → <span className="font-medium text-slate-800">{targetText}</span>
              {people > 0 ? <span className="text-slate-500"> ({plural(people, "person")})</span> : null}
            </>
          ) : (
            "→ tap teams and players to select them"
          )}
        </span>

        <span className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy} className="h-10">
            Cancel
          </Button>
          <Button
            onClick={() => void assign()}
            disabled={busy || !armed || (!teamCount && playerTargets.length === 0)}
            className="h-10"
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Assign
          </Button>
        </span>
      </div>

      {armed?.type === "lesson" && hasTargets ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            Priority
            <span className="inline-flex rounded-md bg-slate-100 p-0.5" role="group" aria-label="Priority">
              {(["LOW", "MEDIUM", "HIGH"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  aria-pressed={priority === value}
                  className={cn(
                    "rounded px-2 py-1 capitalize pointer-coarse:px-3 pointer-coarse:py-1.5",
                    priority === value ? "bg-white font-medium text-slate-900 shadow-sm" : "",
                  )}
                >
                  {value.toLowerCase()}
                </button>
              ))}
            </span>
          </span>
          <label className="flex items-center gap-1.5">
            Due
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
            />
          </label>
        </div>
      ) : null}

      {armed?.type === "journey" && summary.duplicateIds.size > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{plural(summary.duplicateIds.size, "person")} already {summary.duplicateIds.size === 1 ? "has" : "have"} this journey open.</span>
          {duplicatePlayerTargets.length > 0 ? (
            <label className="flex items-center gap-1.5 text-slate-700">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(event) => setSkipDuplicates(event.target.checked)}
                className="h-4 w-4"
              />
              Skip selected players who have it
            </label>
          ) : null}
          {duplicatesInTeams > 0 ? (
            <span className="text-slate-500">Teams always get it for every member.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
