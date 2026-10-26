"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Swords, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FOCUS_META, personName, type Person } from "@/lib/game";
import { Sheet } from "@/components/game/bits";

type League = {
  week: string;
  gameEnabled: boolean;
  isHead: boolean;
  ranking: {
    playerId: string;
    name: string;
    xp: number;
    rank: number;
    level: number;
    weekStreak: number;
  }[];
};

type CoachChallenge = {
  id: string;
  title: string;
  description: string | null;
  focusArea: string | null;
  unit: string;
  higherIsBetter: boolean;
  targetScore: number | null;
  isBenchmark: boolean;
  startsAt: string;
  endsAt: string;
  status: "upcoming" | "active" | "ended";
  canEdit: boolean;
  coach: Person;
  leaderboard: {
    rank: number;
    player: Person;
    score: number;
    attempts: number;
  }[];
};

async function json<T>(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(
      (data as { message?: string } | null)?.message ??
        `Request failed (${res.status})`,
    );
  return data as T;
}

/**
 * Teams page: the game of a team – weekly league, switch (head coach) and
 * coach challenges with leaderboards (benchmark tests feed the player card).
 */
export default function TeamGamePanel({ teamId }: { teamId: string }) {
  const [league, setLeague] = useState<League | null>(null);
  const [challenges, setChallenges] = useState<CoachChallenge[] | null>(null);
  const [editing, setEditing] = useState<CoachChallenge | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [nextLeague, nextChallenges] = await Promise.all([
      fetch(`/api/coach/roster/teams/${encodeURIComponent(teamId)}/league`, {
        cache: "no-store",
      }).then(json<League>),
      fetch(
        `/api/coach/roster/challenges?teamId=${encodeURIComponent(teamId)}`,
        { cache: "no-store" },
      ).then(json<CoachChallenge[]>),
    ]);
    setLeague(nextLeague);
    setChallenges(nextChallenges);
  }, [teamId]);

  useEffect(() => {
    setLeague(null);
    setChallenges(null);
    load().catch(() => setChallenges([]));
  }, [load]);

  async function toggle() {
    if (!league) return;
    setBusy(true);
    try {
      await fetch(
        `/api/coach/roster/teams/${encodeURIComponent(teamId)}/game`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !league.gameEnabled }),
        },
      ).then(json);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not change the setting",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(challenge: CoachChallenge) {
    if (!window.confirm(`Delete the challenge "${challenge.title}"?`)) return;
    try {
      await fetch(
        `/api/coach/roster/challenges/${encodeURIComponent(challenge.id)}`,
        { method: "DELETE" },
      ).then(json);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  if (!league || !challenges) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading league…
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-indigo-600" />
        <h3 className="flex-1 text-sm font-semibold text-slate-900">
          League & challenges
        </h3>
        {league.isHead ? (
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={busy}
            aria-pressed={league.gameEnabled}
            className="flex min-h-9 items-center gap-2 rounded-full px-1 text-xs font-medium text-slate-600 pointer-coarse:min-h-11"
          >
            {league.gameEnabled ? "On" : "Off"}
            <span
              className={cn(
                "h-6 w-11 rounded-full p-0.5 transition-colors",
                league.gameEnabled ? "bg-indigo-600" : "bg-slate-300",
              )}
            >
              <span
                className={cn(
                  "block h-5 w-5 rounded-full bg-white transition-transform",
                  league.gameEnabled ? "translate-x-5" : "",
                )}
              />
            </span>
          </button>
        ) : (
          <span className="text-xs text-slate-500">
            {league.gameEnabled ? "On" : "Off"}
          </span>
        )}
      </div>
      {!league.gameEnabled ? (
        <p className="text-xs text-slate-500">
          Players of this team don&apos;t see a league, team feed or challenges.
          Their own XP, badges and player card still work.
        </p>
      ) : (
        <>
          <ol className="space-y-1 text-sm">
            {league.ranking.slice(0, 5).map((row) => (
              <li key={row.playerId} className="flex items-center gap-2">
                <span className="w-6 text-center">
                  {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
                </span>
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="text-xs text-slate-400">Lv {row.level}</span>
                <span className="w-14 text-right font-semibold tabular-nums">
                  {row.xp} XP
                </span>
              </li>
            ))}
            {league.ranking.length === 0 ? (
              <li className="text-xs text-slate-500">No players yet.</li>
            ) : null}
          </ol>
          <p className="text-[11px] text-slate-400">
            XP this week · resets Monday · top 3 get bonus XP
          </p>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Challenges
            </p>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="flex min-h-9 items-center gap-1 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white pointer-coarse:min-h-11"
            >
              <Plus className="h-3.5 w-3.5" /> New challenge
            </button>
          </div>
          {challenges.length === 0 ? (
            <p className="text-xs text-slate-500">
              Set a challenge (e.g. “10 in a row from 1 m”) – players post
              scores and climb the leaderboard. Benchmark tests also count for
              the player card.
            </p>
          ) : (
            <ul className="space-y-2">
              {challenges.map((challenge) => (
                <li
                  key={challenge.id}
                  className="rounded-lg bg-slate-50 p-2.5 text-sm"
                >
                  <div className="flex items-start gap-2">
                    <Swords className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {challenge.title}
                        {challenge.isBenchmark ? (
                          <span className="ml-1.5 rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800">
                            BENCHMARK
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        {challenge.status} · until{" "}
                        {new Date(challenge.endsAt).toLocaleDateString(
                          undefined,
                          { day: "numeric", month: "short" },
                        )}{" "}
                        · {challenge.leaderboard.length} player
                        {challenge.leaderboard.length === 1 ? "" : "s"}
                      </p>
                      {challenge.leaderboard.slice(0, 3).map((row) => (
                        <p
                          key={row.player.id}
                          className="text-xs text-slate-700"
                        >
                          {["🥇", "🥈", "🥉"][row.rank - 1]}{" "}
                          {personName(row.player)} · {row.score}{" "}
                          {challenge.unit}
                        </p>
                      ))}
                    </div>
                    {challenge.canEdit ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label="Edit"
                          onClick={() => setEditing(challenge)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-white pointer-coarse:h-11 pointer-coarse:w-11"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => void remove(challenge)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-white pointer-coarse:h-11 pointer-coarse:w-11"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {editing ? (
        <ChallengeDialog
          teamId={teamId}
          challenge={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </section>
  );
}

function dateInput(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function ChallengeDialog({
  teamId,
  challenge,
  onClose,
  onSaved,
}: {
  teamId: string;
  challenge: CoachChallenge | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date();
  const [title, setTitle] = useState(challenge?.title ?? "");
  const [description, setDescription] = useState(challenge?.description ?? "");
  const [unit, setUnit] = useState(challenge?.unit ?? "points");
  const [focusArea, setFocusArea] = useState(challenge?.focusArea ?? "");
  const [higherIsBetter, setHigherIsBetter] = useState(
    challenge?.higherIsBetter ?? true,
  );
  const [isBenchmark, setIsBenchmark] = useState(
    challenge?.isBenchmark ?? false,
  );
  const [targetScore, setTargetScore] = useState(
    challenge?.targetScore ? String(challenge.targetScore) : "",
  );
  const [starts, setStarts] = useState(
    dateInput(challenge ? new Date(challenge.startsAt) : today),
  );
  const [ends, setEnds] = useState(
    dateInput(
      challenge
        ? new Date(challenge.endsAt)
        : new Date(today.getTime() + 7 * 86_400_000),
    ),
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const body = {
        teamId,
        title,
        description: description.trim() || null,
        unit: unit.trim() || "points",
        focusArea: focusArea || null,
        higherIsBetter,
        isBenchmark,
        targetScore: targetScore ? Number(targetScore) : null,
        startsAt: new Date(`${starts}T00:00:00`).toISOString(),
        endsAt: new Date(`${ends}T23:59:59`).toISOString(),
      };
      await fetch(
        challenge
          ? `/api/coach/roster/challenges/${encodeURIComponent(challenge.id)}`
          : "/api/coach/roster/challenges",
        {
          method: challenge ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ).then(json);
      toast.success(
        challenge
          ? "Challenge updated"
          : "Challenge created – players were notified",
      );
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base outline-none focus:border-emerald-500";
  return (
    <Sheet
      title={challenge ? "Edit challenge" : "New challenge"}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !title.trim()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
        </button>
      }
    >
      <div className="space-y-4 text-sm">
        <label className="block font-medium text-slate-700">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="10 in a row from 1 m"
            className={field}
          />
        </label>
        <label className="block font-medium text-slate-700">
          Description{" "}
          <span className="font-normal text-slate-400">(optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={1000}
            className={field}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block font-medium text-slate-700">
            Unit
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={20}
              placeholder="putts, m, points"
              className={field}
            />
          </label>
          <label className="block font-medium text-slate-700">
            Focus area
            <select
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              className={field}
            >
              <option value="">—</option>
              {Object.entries(FOCUS_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          {[true, false].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setHigherIsBetter(value)}
              className={cn(
                "min-h-11 flex-1 rounded-lg border-2 font-semibold",
                higherIsBetter === value
                  ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 text-slate-600",
              )}
            >
              {value ? "Higher is better" : "Lower is better"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block font-medium text-slate-700">
            Start
            <input
              type="date"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              className={field}
            />
          </label>
          <label className="block font-medium text-slate-700">
            End
            <input
              type="date"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              className={field}
            />
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3">
          <input
            type="checkbox"
            checked={isBenchmark}
            onChange={(e) => setIsBenchmark(e.target.checked)}
            className="h-5 w-5"
          />
          <span className="flex-1">
            Benchmark test
            <span className="block text-xs text-slate-500">
              Counts for the player card (needs focus area and target)
            </span>
          </span>
        </label>
        {isBenchmark ? (
          <label className="block font-medium text-slate-700">
            Target (= 100 %)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={targetScore}
              onChange={(e) => setTargetScore(e.target.value)}
              className={field}
            />
          </label>
        ) : null}
      </div>
    </Sheet>
  );
}
