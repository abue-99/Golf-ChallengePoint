"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronRight, HelpCircle, MessageSquare, Trophy, X } from "lucide-react";
import TeamIcon from "@/components/TeamIcon";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  nameOf,
  relativeDays,
  teamColor,
  type AgendaItem,
  type AttendanceSummary,
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

type TeamLike = RosterResponse["teams"][number];
type PlayerLike = RosterResponse["players"][number];

function AgendaRow({
  item,
  label,
  teamsById,
  playersById,
  onOpenPlayer,
}: {
  item: AgendaItem;
  label: string;
  teamsById: Map<string, TeamLike>;
  playersById: Map<string, PlayerLike>;
  onOpenPlayer: (playerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const team = item.teamId ? teamsById.get(item.teamId) : undefined;
  const player = item.playerId ? playersById.get(item.playerId) : undefined;
  const attendance = item.attendance && item.attendance.members > 0 ? item.attendance : null;

  return (
    <li className="text-sm">
      <div className="flex items-center gap-2">
        <span
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: team ? teamColor(team.icon) : "#cbd5e1" }}
          aria-hidden="true"
        />
        <span className="w-11 shrink-0 tabular-nums text-slate-500">{label}</span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-medium",
              item.occurrenceStatus === "cancelled" ? "text-slate-400 line-through" : "text-slate-800",
            )}
          >
            {item.title}
          </span>
          <span className="flex items-center gap-1 truncate text-xs text-slate-500">
            {item.occurrenceStatus === "cancelled" ? (
              <span className="font-medium text-rose-700">Cancelled ·</span>
            ) : item.occurrenceStatus === "moved" ? (
              <span className="font-medium text-amber-700" title={item.changeReason ?? undefined}>
                New time ·
              </span>
            ) : null}
            {team?.icon ? <TeamIcon icon={team.icon} size={10} /> : null}
            {team ? team.shortName : player ? nameOf(player) : ""}
            {item.kind === "event" ? " · Team event" : ""}
            {item.location ? ` · ${item.location}` : ""}
          </span>
        </span>
        {attendance ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={`Attendance: ${attendance.going} going, ${attendance.maybe} maybe, ${attendance.notGoing} not going, ${attendance.open} open`}
            className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-1.5 text-xs tabular-nums hover:bg-slate-100 pointer-coarse:min-h-11 pointer-coarse:px-2"
          >
            <span className="inline-flex items-center gap-0.5 text-emerald-700">
              <Check className="h-3 w-3" />
              {attendance.going}
            </span>
            {attendance.maybe ? (
              <span className="inline-flex items-center gap-0.5 text-amber-600">
                <HelpCircle className="h-3 w-3" />
                {attendance.maybe}
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex items-center gap-0.5",
                attendance.notGoing ? "text-rose-600" : "text-slate-400",
              )}
            >
              <X className="h-3 w-3" />
              {attendance.notGoing}
            </span>
            <span className="text-slate-400">/{attendance.members}</span>
          </button>
        ) : null}
      </div>
      {open && attendance ? (
        <AttendanceDetails attendance={attendance} playersById={playersById} onOpenPlayer={onOpenPlayer} />
      ) : null}
    </li>
  );
}

function AttendanceDetails({
  attendance,
  playersById,
  onOpenPlayer,
}: {
  attendance: AttendanceSummary;
  playersById: Map<string, PlayerLike>;
  onOpenPlayer: (playerId: string) => void;
}) {
  const groups: { label: string; status: AttendanceSummary["responses"][number]["status"]; tone: string }[] = [
    { label: "Can't make it", status: "NOT_GOING", tone: "text-rose-700" },
    { label: "Maybe", status: "MAYBE", tone: "text-amber-700" },
    { label: "Going", status: "GOING", tone: "text-emerald-700" },
  ];
  return (
    <div className="ml-3 mt-1 space-y-1.5 rounded-lg bg-slate-50 p-2 text-xs">
      {groups.map((group) => {
        const people = attendance.responses.filter((response) => response.status === group.status);
        if (people.length === 0) return null;
        return (
          <div key={group.status}>
            <p className={cn("font-semibold", group.tone)}>
              {group.label} ({people.length})
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {people.map((response) => {
                const who = playersById.get(response.playerId);
                return (
                  <li key={response.playerId}>
                    <button
                      type="button"
                      onClick={() => onOpenPlayer(response.playerId)}
                      className="text-left text-slate-700 hover:underline pointer-coarse:py-1"
                    >
                      {who ? nameOf(who) : "Player"}
                      {response.note ? <span className="text-slate-500"> – “{response.note}”</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {attendance.open > 0 ? (
        <p className="text-slate-500">
          {attendance.open} {attendance.open === 1 ? "player has" : "players have"} not answered yet.
        </p>
      ) : null}
    </div>
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
  const day = (value: string) =>
    formatDateTime(value, { timeZone: data.timeZone, weekday: "short" });
  // Only a few, so the card keeps its height next to the other two.
  const upcoming = (data.upcoming ?? []).slice(0, data.agenda.length > 1 ? 2 : 3);

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
            {data.agenda.slice(0, 4).map((item, index) => (
              <AgendaRow
                key={`${item.kind}-${item.start}-${index}`}
                item={item}
                label={time(item.start)}
                teamsById={teamsById}
                playersById={playersById}
                onOpenPlayer={onOpenPlayer}
              />
            ))}
            {data.agenda.length > 4 ? (
              <li className="text-xs text-slate-500">+{data.agenda.length - 4} more</li>
            ) : null}
          </ul>
        )}
        {upcoming.length > 0 ? (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Coming up
            </p>
            <ul className="space-y-1.5">
              {upcoming.map((item, index) => (
                <AgendaRow
                  key={`up-${item.kind}-${item.start}-${index}`}
                  item={item}
                  label={day(item.start)}
                  teamsById={teamsById}
                  playersById={playersById}
                  onOpenPlayer={onOpenPlayer}
                />
              ))}
            </ul>
          </div>
        ) : null}
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
