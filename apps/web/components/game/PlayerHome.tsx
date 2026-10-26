"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  ChevronRight,
  Flame,
  Inbox,
  Loader2,
  Play,
  Snowflake,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import CoachMessagesCard from "@/components/messages/CoachMessagesCard";
import {
  CalendarSummaryCard,
  TeamAttendanceCard,
  TrainingChangesCard,
} from "@/components/player/ScheduleCards";
import type { CalendarActivity } from "@/types/calendar";
import { resolveCalendarTimeZone } from "@/lib/timezone";
import {
  emitGameChanged,
  focusMeta,
  gameApi,
  TIER_STYLE,
  useGameData,
  type GameMe,
  type GamePath,
  type GameTeam,
  type Mission,
} from "@/lib/game";
import { PersonAvatar, ProgressBar, Ring, SectionTitle, Sheet } from "./bits";
import { openMission, ReviewBox } from "./MissionPlayer";
import PushPrompt from "./PushPrompt";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function PlayerHome({
  playerId,
  timeZone,
}: {
  playerId: string;
  timeZone?: string | null;
}) {
  const me = useGameData(gameApi.me);
  const path = useGameData(gameApi.path);
  const team = useGameData(gameApi.team);
  const reviews = useGameData(gameApi.reviews);
  const [calendar, setCalendar] = useState<{
    activities: CalendarActivity[];
    now: string;
  } | null>(null);
  const zone = resolveCalendarTimeZone(timeZone);
  const params = useSearchParams();

  useEffect(() => {
    if (!playerId) return;
    api
      .getPlayerCalendar(playerId)
      .then((data: { activities?: CalendarActivity[] }) =>
        setCalendar({
          activities: Array.isArray(data?.activities) ? data.activities : [],
          now: new Date().toISOString(),
        }),
      )
      .catch(() =>
        setCalendar({ activities: [], now: new Date().toISOString() }),
      );
  }, [playerId]);

  // Push "coach reviewed your mission" opens the newest review.
  useEffect(() => {
    if (params.get("reviews") && reviews.data?.length) {
      const fresh =
        reviews.data.find((mission) => !mission.review?.seen) ??
        reviews.data[0];
      openMission(fresh.id);
    }
  }, [params, reviews.data]);

  if (me.loading && !me.data) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="h-44 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-36 animate-pulse rounded-3xl bg-slate-100" />
        <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }
  if (!me.data) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Your progress could not be loaded.{" "}
        <button className="underline" onClick={() => void me.reload()}>
          Try again
        </button>
      </div>
    );
  }

  const newReviews = (reviews.data ?? []).filter(
    (mission) => mission.review && !mission.review.seen,
  );

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-4 lg:grid lg:max-w-5xl lg:grid-cols-[3fr_2fr] lg:gap-6 lg:space-y-0">
      <div className="space-y-5">
        <GameHeader me={me.data} />
        {path.data ? <InboxCard path={path.data} /> : null}
        {path.data ? (
          <NextMissionCard path={path.data} />
        ) : (
          <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
        )}
        {newReviews.length > 0 ? <ReviewsCard missions={newReviews} /> : null}
        <CoachMessagesCard />
        {calendar ? (
          <>
            <TrainingChangesCard
              activities={calendar.activities}
              nowIso={calendar.now}
              timeZone={zone}
            />
            <TeamAttendanceCard
              activities={calendar.activities}
              nowIso={calendar.now}
              timeZone={zone}
            />
          </>
        ) : null}
      </div>
      <div className="space-y-5">
        <QuestsCard me={me.data} />
        {team.data ? <LeagueCard team={team.data} /> : null}
        <CardTeaser me={me.data} />
        <PushPrompt />
        {calendar ? (
          <CalendarSummaryCard
            activities={calendar.activities}
            nowIso={calendar.now}
            timeZone={zone}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Header: level, XP, weekly goal ───────────────────────────────────

export function GameHeader({ me }: { me: GameMe }) {
  const [goalOpen, setGoalOpen] = useState(false);
  const { level, week } = me;
  const tier = TIER_STYLE[level.tier];
  const days = new Set(week.thisWeekDays);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${week.week}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const weekProgress = Math.min(
    100,
    Math.round((week.thisWeekDays.length / week.goal) * 100),
  );

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-green-800 to-slate-900 p-5 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
      <div className="flex items-center gap-4">
        <Ring value={level.progress} size={76} stroke={6} color={tier.ring}>
          <PersonAvatar
            person={{
              firstName: me.player.firstName,
              lastName: me.player.lastName,
              profileImage: me.player.profileImage,
            }}
            size={58}
            className="bg-white/15 text-white"
          />
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-emerald-200">
            Hi {me.player.firstName || "Golfer"} 👋
          </p>
          <p className="text-2xl font-extrabold leading-tight">
            Level {level.level}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
            {tier.label} card
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-semibold text-emerald-100">
          <span>{level.xp} XP</span>
          <span>
            {level.nextLevelXp - level.xp} XP to level {level.level + 1}
          </span>
        </div>
        <ProgressBar
          value={level.progress}
          className="h-2.5 bg-white/15"
          barClassName="bg-gradient-to-r from-amber-400 to-yellow-200"
        />
      </div>
      <button
        type="button"
        onClick={() => setGoalOpen(true)}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-white/10 p-3 text-left"
      >
        <Ring
          value={weekProgress}
          size={48}
          stroke={5}
          color={week.reachedThisWeek ? "#4ade80" : "#fb923c"}
        >
          <span className="text-xs font-bold">
            {week.thisWeekDays.length}/{week.goal}
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <Flame
              className={cn(
                "h-4 w-4",
                week.weekStreak > 0
                  ? "fill-orange-400 text-orange-400"
                  : "text-white/50",
              )}
            />
            {week.weekStreak > 0
              ? `${week.weekStreak}-week streak`
              : "Start a streak"}
            {week.freezes > 0 ? (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-sky-400/20 px-1.5 text-[11px] text-sky-100">
                <Snowflake className="h-3 w-3" /> {week.freezes}
              </span>
            ) : null}
          </p>
          <div className="mt-1.5 flex gap-1">
            {weekDays.map((day, index) => (
              <span
                key={day}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  days.has(day)
                    ? "bg-orange-400 text-orange-950"
                    : day === me.today
                      ? "border border-white/60"
                      : "bg-white/10 text-white/60",
                )}
              >
                {days.has(day) ? (
                  <Check className="h-3 w-3" />
                ) : (
                  WEEKDAYS[index]
                )}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-white/60" />
      </button>
      {goalOpen ? (
        <GoalSheet me={me} onClose={() => setGoalOpen(false)} />
      ) : null}
    </div>
  );
}

export function GoalSheet({
  me,
  onClose,
}: {
  me: GameMe;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function choose(days: number) {
    setBusy(true);
    try {
      await gameApi.setGoal(days);
      emitGameChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="Weekly goal" onClose={onClose}>
      <p className="text-sm text-slate-600">
        How many days a week do you want to practise? A practice day is a
        completed mission, a ticked calendar session, a team training you joined
        or a challenge score.
      </p>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((days) => (
          <button
            key={days}
            type="button"
            disabled={busy}
            onClick={() => void choose(days)}
            className={cn(
              "flex h-12 items-center justify-center rounded-xl border-2 text-lg font-bold",
              me.week.goal === days
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 text-slate-700",
            )}
          >
            {days}
          </button>
        ))}
      </div>
      <ul className="mt-5 space-y-2 text-sm text-slate-600">
        <li>🔥 Every week you reach your goal adds to your streak.</li>
        <li>
          ❄️ Every 4 weeks in a row earn a streak freeze (max. 2) that saves a
          missed week.
        </li>
        <li>🏆 Tournament and holiday weeks don&apos;t break your streak.</li>
        <li>
          Best streak so far: <strong>{me.week.bestWeekStreak}</strong> week
          {me.week.bestWeekStreak === 1 ? "" : "s"}
        </li>
      </ul>
      {me.week.history.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {me.week.history.map((week) => (
            <span
              key={week.week}
              title={`${week.week}: ${week.result}`}
              className={cn(
                "h-6 w-6 rounded-md",
                week.result === "reached"
                  ? "bg-orange-400"
                  : week.result === "frozen"
                    ? "bg-sky-300"
                    : week.result === "protected"
                      ? "bg-slate-300"
                      : "bg-slate-100",
              )}
            />
          ))}
        </div>
      ) : null}
    </Sheet>
  );
}

// ── Inbox: new missions and journeys ─────────────────────────────────

export function InboxCard({ path }: { path: GamePath }) {
  const [busy, setBusy] = useState(false);
  const { journeys, missions } = path.inbox;
  const count = journeys.length + missions.length;
  if (count === 0) return null;
  const coaches = [
    ...new Set(
      [
        ...journeys.map((j) => j.coach.firstName),
        ...missions.map((m) => m.coach.firstName),
      ].filter(Boolean),
    ),
  ];

  async function acceptAll() {
    setBusy(true);
    try {
      const result = await gameApi.accept({ all: true });
      toast.success(
        result.outcome.xpGained > 0
          ? `Accepted! +${result.outcome.xpGained} XP`
          : "Accepted – let's play!",
      );
      emitGameChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="game-rise overflow-hidden rounded-3xl border-2 border-amber-300 bg-amber-50 shadow-sm">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-amber-950">
          <Inbox className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-slate-900">
            {count} new {count === 1 ? "mission" : "missions"}
          </p>
          <p className="truncate text-xs text-slate-600">
            from {coaches.join(", ") || "your coach"}
          </p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-amber-200/70">
        {journeys.map((journey) => (
          <li key={journey.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-xl">🗺️</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {journey.name}
              </p>
              <p className="text-xs text-slate-500">
                Journey · {journey.lessonCount} missions
                {journey.team ? ` · ${journey.team.shortName}` : ""}
              </p>
            </div>
          </li>
        ))}
        {missions.map((mission) => (
          <li key={mission.id}>
            <button
              type="button"
              onClick={() => openMission(mission.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
            >
              <span className="text-xl">
                {focusMeta(mission.lesson.focusArea).emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {mission.lesson.name}
                </p>
                <p className="text-xs text-slate-500">
                  {focusMeta(mission.lesson.focusArea).label} ·{" "}
                  {mission.lesson.durationMinutes} min
                  {mission.isTeam && mission.team
                    ? ` · ${mission.team.shortName}`
                    : ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </li>
        ))}
      </ul>
      <div className="p-4 pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void acceptAll()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 font-extrabold uppercase tracking-wide text-amber-950 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-5 w-5" />
          )}
          Accept all
        </button>
      </div>
    </div>
  );
}

// ── Next mission ─────────────────────────────────────────────────────

function NextMissionCard({ path }: { path: GamePath }) {
  const next = path.next;
  if (!next) {
    if (path.inbox.journeys.length + path.inbox.missions.length > 0)
      return null;
    return (
      <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-6 text-center">
        <p className="text-3xl">🏆</p>
        <p className="mt-2 font-bold text-slate-800">All missions done!</p>
        <p className="mt-1 text-sm text-slate-500">
          Your coach will send new ones. Meanwhile: post a challenge score or
          hit the range.
        </p>
      </div>
    );
  }
  const meta = focusMeta(next.lesson.focusArea);
  const more = path.upNext
    .filter((mission) => mission.id !== next.id)
    .slice(0, 3);
  return (
    <div>
      <SectionTitle
        action={
          <Link
            href="/player"
            className="text-xs font-semibold text-emerald-700"
          >
            All missions →
          </Link>
        }
      >
        {next.status === "ACTIVE" ? "Continue" : "Next mission"}
      </SectionTitle>
      <button
        type="button"
        onClick={() => openMission(next.id)}
        className="relative w-full overflow-hidden rounded-3xl p-5 text-left text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${meta.color}, #0f172a)`,
        }}
      >
        <div className="pointer-events-none absolute -right-6 -top-6 text-[110px] leading-none opacity-15">
          {meta.emoji}
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-white/70">
          {meta.label}
          {next.journeyName ? ` · ${next.journeyName}` : ""}
        </p>
        <p className="mt-1 pr-10 text-2xl font-extrabold leading-tight">
          {next.lesson.name}
        </p>
        {next.lesson.trainingObjective ? (
          <p className="mt-1 line-clamp-2 pr-6 text-sm text-white/80">
            {next.lesson.trainingObjective}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-white/80">
            {next.lesson.durationMinutes} min
            {next.dueDate
              ? ` · due ${new Date(next.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
              : ""}
          </span>
          <span className="game-glow flex h-12 items-center gap-2 rounded-full bg-amber-400 px-5 font-extrabold uppercase text-amber-950">
            <Play className="h-4 w-4 fill-amber-950" />{" "}
            {next.status === "ACTIVE" ? "Resume" : "Play"}
          </span>
        </div>
      </button>
      {more.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {more.map((mission) => (
            <li key={mission.id}>
              <button
                type="button"
                onClick={() => openMission(mission.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 py-2 text-left shadow-sm"
              >
                <span className="text-lg">
                  {focusMeta(mission.lesson.focusArea).emoji}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                  {mission.lesson.name}
                </span>
                <span className="text-xs text-slate-400">
                  {mission.lesson.durationMinutes} min
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── Coach reviews ────────────────────────────────────────────────────

function ReviewsCard({ missions }: { missions: Mission[] }) {
  async function seen() {
    await gameApi.reviewsSeen().catch(() => null);
    emitGameChanged();
  }
  return (
    <div className="game-rise space-y-3 rounded-3xl border-2 border-sky-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-extrabold text-slate-900">
          ⭐{" "}
          {missions.length === 1
            ? "Your coach reviewed a mission"
            : `${missions.length} new coach reviews`}
        </p>
      </div>
      {missions.slice(0, 2).map((mission) => (
        <button
          key={mission.id}
          type="button"
          onClick={() => openMission(mission.id)}
          className="block w-full text-left"
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {mission.lesson.name}
          </p>
          <ReviewBox mission={mission} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => void seen()}
        className="flex h-11 w-full items-center justify-center rounded-2xl bg-sky-600 text-sm font-bold text-white"
      >
        Got it 👍
      </button>
    </div>
  );
}

// ── Quests ───────────────────────────────────────────────────────────

export function QuestsCard({ me }: { me: GameMe }) {
  const done = me.quests.filter((quest) => quest.done).length;
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-extrabold text-slate-900">Weekly quests</p>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
          {done}/{me.quests.length}
        </span>
      </div>
      <ul className="space-y-3">
        {me.quests.map((quest) => (
          <li key={quest.key} className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg",
                quest.done ? "bg-emerald-100" : "bg-slate-100",
              )}
            >
              {quest.done ? "✅" : quest.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  quest.done ? "text-slate-400 line-through" : "text-slate-800",
                )}
              >
                {quest.title}
              </p>
              <ProgressBar
                value={(quest.value / quest.target) * 100}
                className="mt-1 h-1.5"
                barClassName={quest.done ? "bg-emerald-500" : "bg-amber-400"}
              />
            </div>
            <span className="text-xs font-bold text-amber-600">
              +{quest.xp}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── League mini card ─────────────────────────────────────────────────

function LeagueCard({ team }: { team: GameTeam }) {
  const league = team.leagues[0];
  const active = team.challenges.filter(
    (challenge) => challenge.status === "active",
  );
  if (!league && active.length === 0) return null;
  const mine = league?.ranking.find((row) => row.me);
  return (
    <Link
      href="/player/team"
      className="block rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-4 text-white shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="font-extrabold">
          <Trophy className="mr-1 inline h-4 w-4" />{" "}
          {league ? `${league.team.shortName} league` : "Team"}
        </p>
        <ChevronRight className="h-4 w-4 opacity-70" />
      </div>
      {league && mine ? (
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-4xl font-black">#{mine.rank}</p>
            <p className="text-xs text-indigo-100">
              of {league.ranking.length} · {mine.xp} XP this week
            </p>
          </div>
          <div className="flex -space-x-2">
            {league.ranking.slice(0, 3).map((row) => (
              <PersonAvatar
                key={row.playerId}
                person={row}
                size={34}
                className={cn(
                  "border-2",
                  row.me ? "border-amber-300" : "border-indigo-600",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
      {active.length > 0 ? (
        <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold">
          ⚔️{" "}
          {active.length === 1
            ? active[0].title
            : `${active.length} challenges running`}
          {active[0].mine
            ? ` · you: #${active[0].mine.rank}`
            : " · post your score"}
        </p>
      ) : null}
    </Link>
  );
}

// ── Player card teaser ───────────────────────────────────────────────

function CardTeaser({ me }: { me: GameMe }) {
  const tier = TIER_STYLE[me.card.tier];
  const earned = me.badges.filter((badge) => badge.earned);
  return (
    <Link
      href="/me"
      className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm"
    >
      <div
        className={cn(
          "flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br shadow",
          tier.card,
          tier.text,
        )}
      >
        <span className="text-2xl font-black">{me.card.ovr ?? "–"}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider">
          OVR
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold text-slate-900">My player card</p>
        <p className="text-xs text-slate-500">
          {me.card.ovr === null
            ? "Complete missions to get rated"
            : `${tier.label} · ${me.card.attributes.filter((a) => a.score !== null).length}/7 skills rated`}
        </p>
        <p className="mt-1 truncate text-lg">
          {earned
            .slice(-6)
            .map((badge) => badge.emoji)
            .join(" ") || (
            <span className="text-xs text-slate-400">No badges yet</span>
          )}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-400" />
    </Link>
  );
}
