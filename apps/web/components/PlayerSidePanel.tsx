"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Plus,
  ExternalLink,
  LayoutList,
  Mail,
  MessageCircle,
  Phone,
  Route as RouteIcon,
  Trophy,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LearningProgressSection } from "@/components/LearningProgress";
import CoachPlayerCard from "@/components/coach-game/CoachPlayerCard";
import ActivityFeed from "@/components/coach-game/ActivityFeed";
import AssignedWork from "@/components/coach-game/AssignedWork";
import ActivityStrip, { ActivityLegend } from "@/components/ActivityStrip";
import TeamIcon from "@/components/TeamIcon";
import CoachNotes from "@/components/CoachNotes";
import { COACH_ROLE_LABEL, roleLabel, type CoachRole } from "@/lib/coach-roles";
import { FeedbackList } from "@/components/FeedbackList";
import QuickAssign from "@/components/QuickAssign";
import PlayerLoadCard from "@/components/PlayerLoadCard";
import { useUnreadMessages } from "@/lib/messages";
import {
  formatMinutes,
  refreshPlayerLoad,
  usePlayerLoad,
} from "@/lib/player-load";
import {
  formatDateTime,
  initialsOf,
  INACTIVE_AFTER_DAYS,
  isInactive,
  lastActiveLabel,
  missedCount,
  nameOf,
  pendingCount,
  relativeDays,
  type RosterPlayer,
  type RosterTeam,
} from "@/lib/coach-roster";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

type PlayerDetailsProps = {
  player: RosterPlayer;
  teams: RosterTeam[];
  today: string;
  timeZone: string;
  /** Called after feedback or notes changed, so the roster can refresh. */
  onChanged?: () => void;
  /** Open with the assign form expanded (from the row menu). */
  initialAssign?: boolean;
  /** Shows a "Remove from My Players" action at the end. */
  onRemove?: (playerId: string) => void | Promise<void>;
};

/** Player details in a right-hand sheet (coach home). */
export default function PlayerSidePanel({
  onClose,
  ...props
}: PlayerDetailsProps & { onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <PlayerDetails {...props} />
      </SheetContent>
    </Sheet>
  );
}

/**
 * The player details themselves. `inline` renders them without sheet
 * semantics, e.g. in the workspace column of the teams page.
 */
export function PlayerDetails({
  player,
  teams,
  today,
  timeZone,
  onChanged,
  initialAssign = false,
  onRemove,
  inline = false,
}: PlayerDetailsProps & { inline?: boolean }) {
  const Title = inline ? InlineTitle : SheetTitle;
  const Description = inline ? InlineDescription : SheetDescription;
  const Header = inline ? InlineHeader : SheetHeader;
  const [removing, setRemoving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(initialAssign && player.linked);
  const name = nameOf(player);
  const pending = pendingCount(player);
  const missed = missedCount(player);
  const inactive = isInactive(player);
  const playerTeams = teams.filter((team) => player.teamIds.includes(team.id));
  const unreadMessages = useUnreadMessages()?.byUser[player.id] ?? 0;
  const loadData = usePlayerLoad();
  const load = loadData?.players.find((entry) => entry.playerId === player.id);
  const busyWeekIndex = load?.weeks.findIndex((week) => week.level !== "ok") ?? -1;
  const busyWeek = busyWeekIndex >= 0 ? load?.weeks[busyWeekIndex] : undefined;
  const assignLoadWarning =
    load && busyWeek
      ? `${player.firstName || name} already has ${formatMinutes(busyWeek.minutes)} ${busyWeekIndex === 0 ? "this" : "next"} week (limit ${formatMinutes(load.limit)}).`
      : null;
  const journey = player.currentJourney;
  const journeyPercent =
    journey && journey.totalLessons > 0
      ? Math.round((journey.completedLessons / journey.totalLessons) * 100)
      : 0;

  return (
    <>
        <Header className={inline ? "border-b border-slate-100 p-4" : "border-b border-slate-100 p-5 pr-12"}>
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              {player.profileImage ? (
                <AvatarImage src={player.profileImage} alt={name} />
              ) : null}
              <AvatarFallback className="bg-gray-200 text-lg text-gray-600">
                {initialsOf(player)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <Title className="truncate text-lg">{name}</Title>
              <Description>{lastActiveLabel(player)}</Description>
            </div>
          </div>
          {pending > 0 || inactive || missed > 0 || !player.linked ? (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {pending > 0 ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                  {pending} awaiting acceptance
                </span>
              ) : null}
              {missed > 0 ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                  {missed} missed day{missed === 1 ? "" : "s"}
                </span>
              ) : null}
              {inactive ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {player.lastLogin ? `Inactive ${INACTIVE_AFTER_DAYS}+ days` : "Not activated"}
                </span>
              ) : null}
              {!player.linked ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  Team member, not in My Players
                </span>
              ) : null}
            </div>
          ) : null}
        </Header>

        <div className={inline ? "space-y-6 p-4" : "space-y-6 p-5"}>
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => setAssignOpen((open) => !open)}
              disabled={!player.linked}
              aria-expanded={assignOpen}
              title={player.linked ? "Assign a lesson or journey" : "Add the player to My Players to assign lessons"}
              className={
                assignOpen
                  ? "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-[var(--golf-primary)] bg-[var(--golf-primary)] px-2 py-2 text-xs font-medium text-white"
                  : "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-[var(--golf-primary)] px-2 py-2 text-xs font-medium text-[var(--golf-primary)] hover:bg-green-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              }
            >
              <Plus className="h-4 w-4" /> Assign
            </button>
            <Link
              href={`/messages?with=${encodeURIComponent(player.id)}`}
              className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-[var(--golf-primary)] hover:text-[var(--golf-primary)]"
            >
              <MessageCircle className="h-4 w-4" /> Message
              {unreadMessages > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                  {unreadMessages}
                </span>
              ) : null}
            </Link>
            <Link
              href={`/coach/players/${player.id}`}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-[var(--golf-primary)] hover:text-[var(--golf-primary)]"
            >
              <ExternalLink className="h-4 w-4" /> Player
            </Link>
            <Link
              href={`/coach/players/${player.id}/planning`}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-[var(--golf-primary)] hover:text-[var(--golf-primary)]"
            >
              <LayoutList className="h-4 w-4" /> Planning
            </Link>
            <Link
              href={`/coach/players/${player.id}/calendar`}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-[var(--golf-primary)] hover:text-[var(--golf-primary)]"
            >
              <CalendarDays className="h-4 w-4" /> Calendar
            </Link>
          </div>

          {assignOpen ? (
            <Section title={`Assign to ${player.firstName || name}`}>
              <QuickAssign
                target={{ kind: "player", id: player.id, name }}
                loadWarning={assignLoadWarning}
                lessonWarnings={Object.fromEntries(
                  (load?.otherCoachLessons ?? []).map((entry) => [
                    entry.lessonId,
                    `Already open from ${entry.coach}`,
                  ]),
                )}
                onAssigned={() => {
                  setAssignOpen(false);
                  void refreshPlayerLoad();
                  onChanged?.();
                }}
                onCancel={() => setAssignOpen(false)}
              />
            </Section>
          ) : null}

          {player.feedbackCount > 0 ? (
            <Section title={`Awaiting your feedback (${player.feedbackCount})`}>
              <FeedbackList
                playerId={player.id}
                timeZone={timeZone}
                showPlayer={false}
                onChanged={onChanged}
              />
            </Section>
          ) : null}

          {player.days.length > 0 ? (
            <Section title="Past week · next week">
              <ActivityStrip days={player.days} today={today} size="lg" />
              <ActivityLegend className="pt-1" />
            </Section>
          ) : null}

          {load && loadData ? (
            <Section title="Training load · all coaches">
              <PlayerLoadCard
                load={load}
                defaultLimit={loadData.defaultLimit}
                playerName={player.firstName || name}
              />
            </Section>
          ) : null}

          <Section title="Current journey">
            {journey ? (
              <div className="space-y-1.5 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <RouteIcon className="h-4 w-4 text-[var(--golf-primary)]" />
                  <span className="truncate">{journey.name}</span>
                  {journey.totalLessons > 0 ? (
                    <span className="ml-auto shrink-0 text-xs text-slate-500">
                      {journey.completedLessons} / {journey.totalLessons} lessons
                    </span>
                  ) : null}
                </div>
                {journey.totalLessons > 0 ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[var(--golf-primary)]"
                      style={{ width: `${journeyPercent}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No open journey from you.</p>
            )}
          </Section>

          {player.nextTournament ? (
            <Section title="Next tournament">
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{player.nextTournament.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(player.nextTournament.startTime, {
                      timeZone,
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {relativeDays(player.nextTournament.startTime)}
                    {player.nextTournament.location ? ` · ${player.nextTournament.location}` : ""}
                  </p>
                </div>
              </div>
            </Section>
          ) : null}

          <Section title="Coach notes">
            <CoachNotes playerId={player.id} timeZone={timeZone} onChanged={onChanged} />
          </Section>

          <Section title="Missions · all coaches">
            <AssignedWork playerId={player.id} />
          </Section>

          <Section title="Recent activity">
            <ActivityFeed playerId={player.id} compact limit={6} />
          </Section>

          <LearningProgressSection progress={player.learningProgress} />

          <Section title="Details">
            <dl className="space-y-1.5 text-sm">
              {player.email ? (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  <a href={`mailto:${player.email}`} className="break-all text-slate-700 hover:underline">
                    {player.email}
                  </a>
                </div>
              ) : null}
              {player.phoneNumber ? (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                  <a href={`tel:${player.phoneNumber}`} className="text-slate-700 hover:underline">
                    {player.phoneNumber}
                  </a>
                </div>
              ) : null}
              {playerTeams.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {playerTeams.map((team) => (
                    <span
                      key={team.id}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {team.icon ? <TeamIcon icon={team.icon} size={12} /> : null}
                      {team.shortName}
                    </span>
                  ))}
                </div>
              ) : null}
              {player.userClubs?.length ? (
                <div className="flex justify-between gap-2 pt-1">
                  <dt className="text-slate-500">Clubs</dt>
                  <dd className="text-right text-slate-700">
                    {player.userClubs
                      .map((club) => club.club?.name ?? "")
                      .filter(Boolean)
                      .join(", ")}
                  </dd>
                </div>
              ) : null}
              {player.coaches && player.coaches.length > 1 ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Coaches</dt>
                  <dd className="text-right text-slate-700">
                    {player.coaches
                      .map((coach) =>
                        coach.role
                          ? `${nameOf(coach)} (${roleLabel(coach.role)})`
                          : nameOf(coach),
                      )
                      .join(", ")}
                  </dd>
                </div>
              ) : null}
              {player.linked ? (
                <MyRoleRow
                  key={`${player.id}:${player.myRole ?? ""}`}
                  playerId={player.id}
                  role={player.myRole ?? null}
                  onChanged={onChanged}
                />
              ) : null}
            </dl>
          </Section>

          {player.linked ? (
            <CoachPlayerCard playerId={player.id} journeyHref={`/coach/players/${player.id}`} />
          ) : null}
          {onRemove ? (
            <button
              type="button"
              disabled={removing}
              onClick={async () => {
                if (!window.confirm(`Remove "${name}" from your players list?`)) return;
                setRemoving(true);
                try {
                  await onRemove(player.id);
                } finally {
                  setRemoving(false);
                }
              }}
              className="w-full rounded-lg border border-rose-200 px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              {removing ? "Removing…" : "Remove from My Players"}
            </button>
          ) : null}
        </div>
    </>
  );
}

function InlineHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}

function InlineTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={`font-semibold text-slate-900 ${className ?? ""}`}>{children}</h2>;
}

function InlineDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

/** The coach's own role for a linked player (head, assistant, fitness, mental). */
function MyRoleRow({
  playerId,
  role,
  onChanged,
}: {
  playerId: string;
  role: string | null;
  onChanged?: () => void;
}) {
  const [value, setValue] = useState(role ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">My role</dt>
      <dd>
        <select
          aria-label="My role for this player"
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm disabled:opacity-60 pointer-coarse:h-11"
          value={value}
          disabled={saving}
          onChange={async (event) => {
            const next = event.target.value;
            const previous = value;
            setValue(next);
            setSaving(true);
            try {
              const res = await fetch(
                `/api/coach/roster/players/${encodeURIComponent(playerId)}/role`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ role: next || null }),
                },
              );
              if (!res.ok) throw new Error(String(res.status));
              onChanged?.();
            } catch {
              setValue(previous);
            } finally {
              setSaving(false);
            }
          }}
        >
          <option value="">Not set</option>
          {(Object.keys(COACH_ROLE_LABEL) as CoachRole[]).map((key) => (
            <option key={key} value={key}>
              {COACH_ROLE_LABEL[key]}
            </option>
          ))}
        </select>
      </dd>
    </div>
  );
}
