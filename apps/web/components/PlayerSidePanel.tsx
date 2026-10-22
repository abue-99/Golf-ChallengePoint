"use client";

import Link from "next/link";
import {
  CalendarDays,
  ExternalLink,
  LayoutList,
  Mail,
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
import { PlayerCapabilitiesRadarCard } from "@/components/player-capabilities-widget";
import ActivityStrip, { ActivityLegend } from "@/components/ActivityStrip";
import TeamIcon from "@/components/TeamIcon";
import CoachNotes from "@/components/CoachNotes";
import { FeedbackList } from "@/components/FeedbackList";
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

export default function PlayerSidePanel({
  player,
  teams,
  today,
  timeZone,
  onClose,
  onChanged,
}: {
  player: RosterPlayer;
  teams: RosterTeam[];
  today: string;
  timeZone: string;
  onClose: () => void;
  /** Called after feedback or notes changed, so the roster can refresh. */
  onChanged?: () => void;
}) {
  const name = nameOf(player);
  const pending = pendingCount(player);
  const missed = missedCount(player);
  const inactive = isInactive(player);
  const playerTeams = teams.filter((team) => player.teamIds.includes(team.id));
  const journey = player.currentJourney;
  const journeyPercent =
    journey && journey.totalLessons > 0
      ? Math.round((journey.completedLessons / journey.totalLessons) * 100)
      : 0;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-100 p-5 pr-12">
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
              <SheetTitle className="truncate text-lg">{name}</SheetTitle>
              <SheetDescription>{lastActiveLabel(player)}</SheetDescription>
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
        </SheetHeader>

        <div className="space-y-6 p-5">
          <div className="grid grid-cols-3 gap-2">
            <Link
              href={`/coach/players/${player.id}`}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-[var(--golf-primary)] hover:text-[var(--golf-primary)]"
            >
              <ExternalLink className="h-4 w-4" /> Player
            </Link>
            <Link
              href={`/coach/players/${player.id}/planning`}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-[var(--golf-primary)] hover:text-[var(--golf-primary)]"
            >
              <LayoutList className="h-4 w-4" /> Planning
            </Link>
            <Link
              href={`/coach/players/${player.id}/calendar`}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-[var(--golf-primary)] hover:text-[var(--golf-primary)]"
            >
              <CalendarDays className="h-4 w-4" /> Calendar
            </Link>
          </div>

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

          <Section title="Private notes">
            <CoachNotes playerId={player.id} timeZone={timeZone} onChanged={onChanged} />
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
                      .map((coach) => nameOf(coach))
                      .join(", ")}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Section>

          {player.linked ? (
            <PlayerCapabilitiesRadarCard
              playerId={player.id}
              title="Skill Radar"
              journeyLabel="Go to journey"
              journeyHref={`/coach/players/${player.id}`}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
