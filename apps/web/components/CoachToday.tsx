"use client";

import Link from "next/link";
import { CalendarDays, Check, ChevronRight, MessageSquare, Trophy, X } from "lucide-react";
import TeamIcon from "@/components/TeamIcon";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  nameOf,
  relativeDays,
  teamColor,
  type RosterResponse,
} from "@/lib/coach-roster";

function Card({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: typeof CalendarDays;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4", className)}>
      <header className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--golf-primary)]" />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {action ? <span className="ml-auto">{action}</span> : null}
      </header>
      {children}
    </section>
  );
}

/** "Today" strip on the coach home: what is on today and what waits for the coach. */
export default function CoachToday({
  data,
  onOpenFeedback,
  onOpenPlayer,
}: {
  data: RosterResponse;
  onOpenFeedback: () => void;
  onOpenPlayer: (playerId: string) => void;
}) {
  const teamsById = new Map(data.teams.map((team) => [team.id, team]));
  const playersById = new Map(data.players.map((player) => [player.id, player]));
  const time = (value: string) =>
    formatDateTime(value, {
      timeZone: data.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card
        title="Today"
        icon={CalendarDays}
        action={
          <Link href="/calendar" className="text-xs font-medium text-[var(--golf-primary)] hover:underline">
            Calendar
          </Link>
        }
      >
        {data.agenda.length === 0 ? (
          <p className="text-sm text-slate-500">No training windows or team events today.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.agenda.slice(0, 4).map((item, index) => {
              const team = item.teamId ? teamsById.get(item.teamId) : undefined;
              const player = item.playerId ? playersById.get(item.playerId) : undefined;
              return (
                <li key={`${item.kind}-${item.start}-${index}`} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: team ? teamColor(team.icon) : "#cbd5e1" }}
                    aria-hidden="true"
                  />
                  <span className="w-11 shrink-0 tabular-nums text-slate-500">{time(item.start)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{item.title}</span>
                    <span className="flex items-center gap-1 truncate text-xs text-slate-500">
                      {team?.icon ? <TeamIcon icon={team.icon} size={10} /> : null}
                      {team ? team.shortName : player ? nameOf(player) : ""}
                      {item.kind === "event" ? " · Team event" : ""}
                      {item.location ? ` · ${item.location}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
            {data.agenda.length > 4 ? (
              <li className="text-xs text-slate-500">+{data.agenda.length - 4} more</li>
            ) : null}
          </ul>
        )}
      </Card>

      <Card
        title="Awaiting your feedback"
        icon={MessageSquare}
        className={data.feedbackTotal === 0 ? "hidden md:flex" : undefined}
      >
        {data.feedbackTotal === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <Check className="h-4 w-4 text-green-600" /> You are up to date.
          </p>
        ) : (
          <button
            type="button"
            onClick={onOpenFeedback}
            className="group flex items-center gap-3 rounded-lg text-left"
          >
            <span className="text-3xl font-semibold tabular-nums text-[var(--golf-heading)]">
              {data.feedbackTotal}
            </span>
            <span className="text-sm text-slate-600">
              completed lesson{data.feedbackTotal === 1 ? "" : "s"} to review
              <span className="flex items-center gap-0.5 font-medium text-[var(--golf-primary)] group-hover:underline">
                Review now <ChevronRight className="h-4 w-4" />
              </span>
            </span>
          </button>
        )}
      </Card>

      <Card
        title="Tournaments this week"
        icon={Trophy}
        className={data.tournamentsThisWeek.length === 0 ? "hidden md:flex" : undefined}
      >
        {data.tournamentsThisWeek.length === 0 ? (
          <p className="text-sm text-slate-500">No tournaments in the next 7 days.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.tournamentsThisWeek.slice(0, 4).map((tournament) => {
              const player = playersById.get(tournament.playerId);
              return (
                <li key={`${tournament.playerId}-${tournament.startTime}`}>
                  <button
                    type="button"
                    onClick={() => onOpenPlayer(tournament.playerId)}
                    className="block w-full min-w-0 text-left text-sm"
                  >
                    <span className="block truncate font-medium text-slate-800 hover:text-[var(--golf-primary)]">
                      {player ? nameOf(player) : "Player"}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {tournament.title} ·{" "}
                      {formatDateTime(tournament.startTime, {
                        timeZone: data.timeZone,
                        weekday: "short",
                      })}{" "}
                      ({relativeDays(tournament.startTime)})
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** First steps for coaches who are just getting started. */
export function GettingStarted({
  data,
  onDismiss,
}: {
  data: RosterResponse;
  onDismiss: () => void;
}) {
  const steps = [
    {
      label: "Invite your first player",
      done: data.players.length > 0,
      href: "/teams",
    },
    {
      label: "Create a team (optional)",
      done: data.teams.length > 0,
      optional: true,
      href: "/teams",
    },
    {
      label: "Assign a journey",
      done: data.players.some(
        (player) =>
          Boolean(player.currentJourney) ||
          Object.values(player.learningProgress?.journeys ?? {}).some((count) => Number(count) > 0),
      ),
      href: "/coach/journeys",
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  // Teams are optional: once the required steps are done the card disappears.
  if (steps.every((step) => step.done || ("optional" in step && step.optional))) return null;

  return (
    <section className="relative rounded-xl border border-[var(--golf-primary)]/30 bg-green-50/60 p-4">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
        aria-label="Hide getting started"
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className="text-sm font-semibold text-slate-800">Getting started</h2>
      <p className="mb-3 text-xs text-slate-500">
        {doneCount} of {steps.length} done
      </p>
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm",
                step.done
                  ? "border-green-200 text-slate-500"
                  : "border-slate-200 text-slate-800 hover:border-[var(--golf-primary)]",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  step.done ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600",
                )}
              >
                {step.done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className={step.done ? "line-through" : ""}>{step.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
