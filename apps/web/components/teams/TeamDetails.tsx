"use client";

import {
  CalendarDays,
  ClipboardPlus,
  Route as RouteIcon,
  SquarePen,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TeamIcon from "@/components/TeamIcon";
import {
  formatDateTime,
  lastActiveLabel,
  needsAttention,
  type RosterPlayer,
  type RosterTeam,
} from "@/lib/coach-roster";
import { initials, playerDisplayName, type Team } from "./shared";

function ActionButton({
  icon: Icon,
  label,
  onClick,
  tone = "default",
  badge,
}: {
  icon: typeof CalendarDays;
  label: string;
  onClick: () => void;
  tone?: "default" | "primary" | "danger";
  badge?: number;
}) {
  const tones = {
    default: "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
    primary: "border-[var(--golf-primary)] text-[var(--golf-primary)] hover:bg-green-50",
    danger: "border-rose-200 text-rose-700 hover:bg-rose-50",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium ${tones[tone]}`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {badge ? (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** Team details in the workspace column (or a sheet on narrow screens). */
export default function TeamDetails({
  team,
  rosterTeam,
  rosterPlayers,
  timeZone,
  planCount,
  windowCount,
  onAssign,
  onEdit,
  onJourneys,
  onTrainingWindows,
  onDelete,
  onOpenPlayer,
}: {
  team: Team;
  rosterTeam?: RosterTeam;
  rosterPlayers: Map<string, RosterPlayer>;
  timeZone: string;
  planCount: number;
  windowCount: number;
  onAssign: () => void;
  onEdit: () => void;
  onJourneys: () => void;
  onTrainingWindows: () => void;
  onDelete: () => void;
  onOpenPlayer: (playerId: string) => void;
}) {
  const next = rosterTeam?.nextTrainingWindow;
  const plans = rosterTeam?.plans ?? [];

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100">
          {team.icon ? <TeamIcon icon={team.icon} size={22} /> : <span className="text-xl">⛳</span>}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900">{team.shortName}</h2>
          <p className="text-sm text-slate-500">{team.description?.trim() || "No description yet."}</p>
          {team.category ? <p className="mt-0.5 text-xs text-slate-400">{team.category}</p> : null}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <ActionButton icon={ClipboardPlus} label="Assign" tone="primary" onClick={onAssign} />
        <ActionButton icon={RouteIcon} label="Journeys" onClick={onJourneys} badge={planCount} />
        <ActionButton icon={CalendarDays} label="Windows" onClick={onTrainingWindows} badge={windowCount} />
        <ActionButton icon={SquarePen} label="Edit team" onClick={onEdit} />
        <ActionButton icon={Trash2} label="Delete" tone="danger" onClick={onDelete} />
      </div>

      {next || plans.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
          {next ? (
            <p className="flex items-center gap-2 text-slate-700">
              <CalendarDays className="h-4 w-4 shrink-0 text-[var(--golf-primary)]" />
              <span>
                Next training:{" "}
                <span className="font-medium">
                  {formatDateTime(next.start, {
                    timeZone,
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
                <span className="text-slate-500"> · {next.title}</span>
              </span>
            </p>
          ) : null}
          {plans.map((plan) => (
            <p key={plan.id} className="flex items-center gap-2 text-slate-700">
              <RouteIcon className="h-4 w-4 shrink-0 text-[var(--golf-primary)]" />
              <span className="truncate">Plan: {plan.name}</span>
            </p>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Members ({team.members.length})
        </h3>
        {team.members.length === 0 ? (
          <p className="text-sm text-slate-500">No members yet. Use “Edit team” to add players.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {team.members.map((member) => {
              const roster = rosterPlayers.get(member.userId);
              const attention = roster ? needsAttention(roster) : false;
              return (
                <li key={member.userId}>
                  <button
                    type="button"
                    onClick={() => onOpenPlayer(member.userId)}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="relative">
                      <Avatar className="h-8 w-8 text-xs">
                        {member.user?.profileImage ? (
                          <AvatarImage src={member.user.profileImage} alt="" />
                        ) : null}
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {member.user ? initials(member.user) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      {attention ? (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {member.user ? playerDisplayName(member.user) : member.userId}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {roster
                          ? [roster.currentJourney?.name, lastActiveLabel(roster)].filter(Boolean).join(" · ")
                          : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
