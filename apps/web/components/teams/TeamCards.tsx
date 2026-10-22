"use client";

import type React from "react";
import { useDroppable } from "@dnd-kit/core";
import { CalendarDays, Check, Route as RouteIcon, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CompactCoachPlayerCard from "@/components/CompactCoachPlayerCard";
import TeamIcon from "@/components/TeamIcon";
import { cn } from "@/lib/utils";
import {
  countLabel,
  initials,
  playerDisplayName,
  queueCountLabel,
  type Player,
  type Team,
} from "./shared";

/** Round check mark shown on cards while selecting targets. */
function SelectMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
        selected
          ? "border-[var(--golf-primary)] bg-[var(--golf-primary)] text-white"
          : "border-slate-300 bg-white/90",
      )}
      aria-hidden="true"
    >
      {selected ? <Check className="h-3.5 w-3.5" /> : null}
    </span>
  );
}

/** Small amber hint, e.g. "2/4 have it" while a journey is armed. */
function DuplicateHint({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
      {text}
    </span>
  );
}

export function TeamCard({
  team,
  teamJourneyCount,
  queueById,
  attentionIds,
  nextWindowLabel,
  planName,
  selecting,
  selected,
  highlighted,
  duplicateHint,
  footerContent,
  onCardClick,
  onMemberClick,
}: {
  team: Team;
  teamJourneyCount: number;
  queueById: Record<string, number>;
  /** Members that need the coach's attention (red dot). */
  attentionIds: Set<string>;
  nextWindowLabel?: string | null;
  planName?: string | null;
  selecting: boolean;
  selected: boolean;
  /** Shown in the details pane right now. */
  highlighted?: boolean;
  duplicateHint?: string | null;
  footerContent: React.ReactNode;
  onCardClick: () => void;
  onMemberClick: (playerId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `team:${team.id}`,
    data: { teamName: team.shortName },
  });
  const visibleMembers = team.members.slice(0, 5);
  const extraMembers = Math.max(team.members.length - 5, 0);

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-pressed={selecting ? selected : undefined}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onCardClick();
        }
      }}
      className={cn(
        "relative flex min-h-[220px] w-[168px] min-w-[168px] cursor-pointer select-none flex-col rounded-2xl border border-[var(--golf-muted)] bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-[176px] sm:min-w-[176px]",
        highlighted && !selecting && "border-slate-400 ring-2 ring-slate-300",
        selected && "border-[var(--golf-primary)] bg-green-50/60 ring-2 ring-[var(--golf-primary)]",
        isOver && "border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-400/60",
      )}
      onClick={onCardClick}
      title={[team.shortName, team.description?.trim()].filter(Boolean).join(" — ")}
    >
      {selecting ? <SelectMark selected={selected} /> : null}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
          {team.icon ? <TeamIcon icon={team.icon} size={18} /> : <span className="text-lg">⛳</span>}
        </div>
        <div className={cn("min-w-0 flex-1", selecting && "pr-5")}>
          <p className="truncate text-sm font-semibold text-[var(--golf-heading)]" title={team.shortName}>
            {team.shortName}
          </p>
          <p
            className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500"
            title={team.description ?? undefined}
          >
            {team.description?.trim() || "No description yet."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Members</div>
        <div className="mt-2 min-h-[2.25rem]">
          <div className="flex max-w-[150px] flex-wrap gap-1.5">
            {visibleMembers.length > 0 ? (
              visibleMembers.map((member) => (
                <button
                  key={member.userId}
                  type="button"
                  className="relative"
                  onClick={(event) => {
                    // While selecting, a tap anywhere on the card selects the team.
                    if (selecting) return;
                    event.stopPropagation();
                    if (member.user) onMemberClick(member.user.id);
                  }}
                  title={member.user ? playerDisplayName(member.user) : member.userId}
                >
                  <Avatar className="h-7 w-7 text-[11px]">
                    {member.user?.profileImage ? (
                      <AvatarImage src={member.user.profileImage} alt={member.user ? initials(member.user) : "?"} />
                    ) : null}
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {member.user ? initials(member.user) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  {attentionIds.has(member.userId) ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500"
                      aria-label="Needs attention"
                      role="img"
                    />
                  ) : null}
                  {(queueById[member.userId] ?? 0) > 0 ? (
                    <span
                      className="absolute -bottom-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-bold leading-none text-white"
                      title={`Queued lessons: ${queueById[member.userId] ?? 0}`}
                    >
                      {queueCountLabel(queueById[member.userId] ?? 0)}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-400">No members yet.</span>
            )}
            {extraMembers > 0 ? (
              <span
                className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600"
                title={`${extraMembers} more members`}
              >
                +{extraMembers}
              </span>
            ) : null}
          </div>
        </div>

        {nextWindowLabel || planName || duplicateHint ? (
          <div className="mt-3 space-y-1 text-[11px] leading-4 text-slate-500">
            {nextWindowLabel ? (
              <p className="flex items-center gap-1 truncate" title={`Next training window: ${nextWindowLabel}`}>
                <CalendarDays className="h-3 w-3 shrink-0" />
                <span className="truncate">{nextWindowLabel}</span>
              </p>
            ) : null}
            {planName ? (
              <p className="flex items-center gap-1 truncate" title={`Plan: ${planName}`}>
                <RouteIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{planName}</span>
              </p>
            ) : null}
            {duplicateHint ? <DuplicateHint text={duplicateHint} /> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span>{countLabel(team.members.length, "player")}</span>
            <span className="text-slate-300">•</span>
            <span>{countLabel(teamJourneyCount, "journey")}</span>
          </div>
          {isOver ? (
            <span className="block text-[11px] font-medium text-emerald-700">Assign to {team.shortName}</span>
          ) : null}
        </div>
        {selecting ? null : footerContent}
      </div>
    </div>
  );
}

export function PlayerCard({
  player,
  attention,
  selecting,
  selected,
  highlighted,
  duplicateHint,
  onCardClick,
  onRemove,
}: {
  player: Player;
  attention: boolean;
  selecting: boolean;
  selected: boolean;
  highlighted?: boolean;
  duplicateHint?: string | null;
  onCardClick: () => void;
  onRemove: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `player:${player.id}`,
    data: { playerName: playerDisplayName(player) },
  });
  const name = playerDisplayName(player);
  const isInactive = !player.lastLogin;

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-pressed={selecting ? selected : undefined}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onCardClick();
        }
      }}
      className="group relative w-44 min-w-44 cursor-pointer select-none"
      onClick={onCardClick}
      title={selecting ? `Select ${name}` : "Click to view details"}
    >
      {selecting ? (
        <SelectMark selected={selected} />
      ) : (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="absolute right-1 top-1 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 pointer-fine:group-hover:flex"
          aria-label="Remove player"
          title="Remove player"
        >
          <X size={10} />
        </button>
      )}
      {attention ? (
        <span
          className="absolute left-[calc(50%+18px)] top-4 z-10 h-3 w-3 rounded-full border-2 border-white bg-rose-500"
          aria-label="Needs attention"
          role="img"
        />
      ) : null}
      <CompactCoachPlayerCard
        name={name}
        initials={initials(player)}
        profileImage={player.profileImage}
        progress={player.learningProgress}
        inactive={isInactive}
        className={cn(
          "h-full",
          highlighted && !selecting && "border-slate-400 ring-2 ring-slate-300",
          selected && "border-[var(--golf-primary)] bg-green-50/60 ring-2 ring-[var(--golf-primary)]",
          isOver && "border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-400/60",
        )}
        contentClassName="gap-2 p-3"
        nameClassName="min-h-[2.2rem] text-[13px]"
        statusContent={
          isOver ? (
            <span className="text-[11px] font-medium text-emerald-700">{`Assign to ${name}`}</span>
          ) : undefined
        }
        footer={duplicateHint ? <DuplicateHint text={duplicateHint} /> : undefined}
      />
    </div>
  );
}
