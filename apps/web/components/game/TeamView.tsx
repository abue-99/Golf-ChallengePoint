"use client";

import { useState } from "react";
import { Loader2, Minus, Plus, Swords, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  emitGameChanged,
  focusMeta,
  gameApi,
  personName,
  timeAgo,
  useGameData,
  type Challenge,
  type TeamFeedItem,
} from "@/lib/game";
import { PersonAvatar, SectionTitle, Sheet, Stars } from "./bits";

export default function TeamView() {
  const { data, loading, setData } = useGameData(gameApi.team);
  const [entering, setEntering] = useState<Challenge | null>(null);
  const [now] = useState(() => Date.now());

  if (loading && !data)
    return (
      <div className="mx-auto h-96 max-w-lg animate-pulse rounded-3xl bg-slate-200" />
    );
  if (!data)
    return (
      <p className="text-sm text-rose-700">The team could not be loaded.</p>
    );

  if (data.leagues.length === 0 && data.challenges.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
        <p className="text-4xl">👥</p>
        <p className="mt-2 font-bold text-slate-800">No team league yet</p>
        <p className="mt-1 text-sm text-slate-500">
          When you are in a team, you compete in a weekly league and in coach
          challenges here.
        </p>
      </div>
    );
  }

  async function toggleKudos(item: TeamFeedItem) {
    try {
      const result = await gameApi.kudos(item.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              feed: prev.feed.map((entry) =>
                entry.id === item.id
                  ? {
                      ...entry,
                      kudos: result.kudos,
                      gaveKudos: result.gaveKudos,
                    }
                  : entry,
              ),
            }
          : prev,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send kudos");
    }
  }

  const active = data.challenges.filter(
    (challenge) => challenge.status !== "ended",
  );
  const ended = data.challenges.filter(
    (challenge) => challenge.status === "ended",
  );

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-6">
      <header className="px-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Team
        </h1>
        <p className="text-sm text-slate-500">
          Weekly league · resets every Monday
        </p>
      </header>

      {data.leagues.map((league) => (
        <section
          key={league.team.id}
          className="overflow-hidden rounded-3xl bg-white shadow-sm"
        >
          <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-700 px-4 py-3 text-white">
            <Trophy className="h-5 w-5" />
            <p className="flex-1 font-extrabold">
              {league.team.icon ?? ""} {league.team.shortName} league
            </p>
            <span className="text-xs text-indigo-100">XP this week</span>
          </div>
          <ol>
            {league.ranking.map((row) => (
              <li
                key={row.playerId}
                className={cn(
                  "flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 last:border-0",
                  row.me ? "bg-amber-50" : "",
                )}
              >
                <span
                  className={cn(
                    "w-7 text-center text-lg font-black",
                    row.rank === 1
                      ? "text-amber-500"
                      : row.rank === 2
                        ? "text-slate-400"
                        : row.rank === 3
                          ? "text-orange-700"
                          : "text-slate-400",
                  )}
                >
                  {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
                </span>
                <PersonAvatar person={row} size={36} />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    row.me ? "font-extrabold" : "font-semibold text-slate-700",
                  )}
                >
                  {row.me ? "You" : personName(row)}
                </span>
                <span className="font-bold tabular-nums text-slate-900">
                  {row.xp}
                </span>
              </li>
            ))}
          </ol>
          <p className="px-4 py-2 text-[11px] text-slate-400">
            Top 3 on Monday earn bonus XP and the Podium badge.
          </p>
        </section>
      ))}

      {active.length > 0 ? (
        <section>
          <SectionTitle>Challenges</SectionTitle>
          <div className="space-y-3">
            {active.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                now={now}
                onEnter={() => setEntering(challenge)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.feed.length > 0 ? (
        <section>
          <SectionTitle>Team activity</SectionTitle>
          <ul className="space-y-2">
            {data.feed.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm"
              >
                <PersonAvatar person={item.player} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    <span className="font-bold">
                      {item.mine ? "You" : item.player.firstName}
                    </span>{" "}
                    {feedText(item)}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-slate-400">
                    {timeAgo(item.createdAt)}
                    {item.stars ? <Stars value={item.stars} size={11} /> : null}
                    {item.kudosFrom.length ? (
                      <span>· 👏 {item.kudosFrom.join(", ")}</span>
                    ) : null}
                  </p>
                </div>
                {item.mine ? (
                  item.kudos > 0 ? (
                    <span className="text-sm font-bold text-slate-500">
                      👏 {item.kudos}
                    </span>
                  ) : null
                ) : (
                  <button
                    type="button"
                    onClick={() => void toggleKudos(item)}
                    aria-pressed={item.gaveKudos}
                    className={cn(
                      "flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 text-sm font-bold transition-transform active:scale-90",
                      item.gaveKudos
                        ? "game-pop bg-amber-400 text-amber-950"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    👏{item.kudos > 0 ? <span>{item.kudos}</span> : null}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ended.length > 0 ? (
        <section>
          <SectionTitle>Finished challenges</SectionTitle>
          <div className="space-y-3">
            {ended.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                now={now}
              />
            ))}
          </div>
        </section>
      ) : null}

      {entering ? (
        <EnterScoreSheet
          challenge={entering}
          onClose={() => setEntering(null)}
        />
      ) : null}
    </div>
  );
}

function feedText(item: TeamFeedItem) {
  const title = item.title ?? "";
  switch (item.type) {
    case "LESSON_COMPLETED":
      return `completed ${title}`;
    case "JOURNEY_COMPLETED":
      return `finished the journey ${title} 🏁`;
    case "BLOCK_COMPLETED":
      return `opened a chest: ${title} 🎁`;
    case "BADGE_EARNED":
      return `earned ${title}`;
    case "LEVEL_UP":
      return `${title.replace("Reached", "reached")} 🚀`;
    case "WEEK_GOAL":
      return "reached the weekly goal 🔥";
    case "CHALLENGE_ENTRY":
      return `posted ${item.best ?? ""} ${item.unit ?? ""} in ${title}`;
    case "LEAGUE_PODIUM":
      return `finished ${title} 🏆`;
    case "COACH_REVIEW":
      return `got a Coach's pick for ${title} 🏅`;
    default:
      return title;
  }
}

function ChallengeCard({
  challenge,
  now,
  onEnter,
}: {
  challenge: Challenge;
  now: number;
  onEnter?: () => void;
}) {
  const meta = focusMeta(challenge.focusArea);
  const ends = new Date(challenge.endsAt);
  const daysLeft = Math.max(0, Math.ceil((ends.getTime() - now) / 86_400_000));
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
          style={{ background: `${meta.color}22` }}
        >
          {challenge.isBenchmark ? (
            "📏"
          ) : (
            <Swords className="h-5 w-5" style={{ color: meta.color }} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-slate-900">{challenge.title}</p>
          <p className="text-xs text-slate-500">
            {challenge.team.shortName} ·{" "}
            {challenge.status === "upcoming"
              ? `starts ${new Date(challenge.startsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
              : challenge.status === "ended"
                ? "finished"
                : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
            {challenge.isBenchmark ? " · counts for your player card" : ""}
          </p>
          {challenge.description ? (
            <p className="mt-1 text-sm text-slate-600">
              {challenge.description}
            </p>
          ) : null}
        </div>
      </div>
      {challenge.leaderboard.length > 0 ? (
        <ol className="border-t border-slate-100 px-4 py-2">
          {challenge.leaderboard.slice(0, 5).map((row) => (
            <li
              key={row.player.id}
              className={cn(
                "flex items-center gap-2 py-1 text-sm",
                row.me ? "font-extrabold" : "",
              )}
            >
              <span className="w-6 text-center">
                {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {row.me ? "You" : personName(row.player)}
              </span>
              <span className="tabular-nums">
                {row.score} {challenge.unit}
              </span>
            </li>
          ))}
          {challenge.mine && challenge.mine.rank > 5 ? (
            <li className="flex items-center gap-2 py-1 text-sm font-extrabold">
              <span className="w-6 text-center">{challenge.mine.rank}</span>
              <span className="flex-1">You</span>
              <span>
                {challenge.mine.score} {challenge.unit}
              </span>
            </li>
          ) : null}
        </ol>
      ) : null}
      {onEnter && challenge.status === "active" ? (
        <div className="p-3 pt-0">
          <button
            type="button"
            onClick={onEnter}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 font-bold text-white"
          >
            <Swords className="h-4 w-4" />{" "}
            {challenge.mine ? "Beat your score" : "Post your score"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EnterScoreSheet({
  challenge,
  onClose,
}: {
  challenge: Challenge;
  onClose: () => void;
}) {
  const [score, setScore] = useState<number>(challenge.mine?.score ?? 0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const result = await gameApi.enterChallenge(
        challenge.id,
        score,
        note.trim() || undefined,
      );
      toast.success(
        result.outcome.xpGained > 0
          ? `Score posted! +${result.outcome.xpGained} XP`
          : "Score posted!",
      );
      emitGameChanged();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not post the score",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={challenge.title}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-extrabold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Post
          score
        </button>
      }
    >
      <p className="text-sm text-slate-600">
        {challenge.higherIsBetter ? "Higher is better." : "Lower is better."}{" "}
        Your best try counts.
      </p>
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Minus one"
          onClick={() => setScore((value) => Math.max(0, value - 1))}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-200"
        >
          <Minus className="h-6 w-6" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={score}
          onChange={(event) =>
            setScore(Math.max(0, Number(event.target.value) || 0))
          }
          className="w-28 rounded-2xl border-2 border-slate-200 py-2 text-center text-4xl font-black outline-none focus:border-emerald-500"
          aria-label="Score"
        />
        <button
          type="button"
          aria-label="Plus one"
          onClick={() => setScore((value) => value + 1)}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-200"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
      <p className="mt-1 text-center text-sm font-semibold text-slate-500">
        {challenge.unit}
      </p>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Note (optional)"
        className="mt-5 w-full rounded-2xl border border-slate-200 p-3 text-base outline-none focus:border-emerald-500"
      />
    </Sheet>
  );
}
