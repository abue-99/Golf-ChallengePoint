"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  Flame,
  LogOut,
  Target,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  eventText,
  gameApi,
  personName,
  timeAgo,
  useGameData,
  type Badge,
} from "@/lib/game";
import { ProgressBar, Sheet } from "./bits";
import { AttributeList, PlayerCardFace, SkillRadar } from "./PlayerCardView";
import { GoalSheet } from "./PlayerHome";

type Tab = "skills" | "badges" | "activity";

export default function MeView() {
  const router = useRouter();
  const { data, loading } = useGameData(gameApi.me);
  const [tab, setTab] = useState<Tab>("skills");
  const [goalOpen, setGoalOpen] = useState(false);
  const [badge, setBadge] = useState<Badge | null>(null);

  if (loading && !data) {
    return (
      <div className="mx-auto h-[420px] max-w-lg animate-pulse rounded-3xl bg-slate-200" />
    );
  }
  if (!data)
    return (
      <p className="text-sm text-rose-700">Your profile could not be loaded.</p>
    );

  const earned = data.badges.filter((item) => item.earned);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-6">
      <PlayerCardFace
        card={data.card}
        level={data.level}
        name={personName(data.player)}
        person={data.player}
        className="game-rise"
      />

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="XP" value={data.level.xp} />
        <Stat label="Best streak" value={`${data.week.bestWeekStreak} wk`} />
        <Stat label="Badges" value={`${earned.length}/${data.badges.length}`} />
      </div>

      <button
        type="button"
        onClick={() => setGoalOpen(true)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left shadow-sm"
      >
        <Target className="h-5 w-5 text-emerald-600" />
        <span className="flex-1 text-sm font-semibold text-slate-800">
          Weekly goal: {data.week.goal} practice day
          {data.week.goal === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1 text-sm font-bold text-orange-600">
          <Flame className="h-4 w-4" /> {data.week.weekStreak}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </button>

      <div className="flex rounded-2xl bg-slate-200/70 p-1">
        {(
          [
            ["skills", "Skills"],
            ["badges", "Badges"],
            ["activity", "Activity"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "min-h-11 flex-1 rounded-xl text-sm font-bold",
              tab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "skills" ? (
        <div className="space-y-5 rounded-3xl bg-white p-4 shadow-sm">
          <SkillRadar card={data.card} />
          <AttributeList card={data.card} />
          <p className="text-xs text-slate-400">
            Skills come only from real results: coach reviews, benchmark tests,
            mission stars and your self-assessment.
          </p>
        </div>
      ) : tab === "badges" ? (
        <div className="grid grid-cols-3 gap-3">
          {data.badges.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setBadge(item)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl p-3 text-center shadow-sm",
                item.earned ? "bg-white" : "bg-slate-100",
              )}
            >
              <span
                className={cn(
                  "text-3xl",
                  item.earned ? "" : "opacity-30 grayscale",
                )}
              >
                {item.emoji}
              </span>
              <span
                className={cn(
                  "text-[11px] font-bold leading-tight",
                  item.earned ? "text-slate-800" : "text-slate-400",
                )}
              >
                {item.title}
              </span>
              {!item.earned ? (
                <ProgressBar
                  value={(item.value / item.target) * 100}
                  className="mt-1 h-1"
                  barClassName="bg-slate-400"
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {data.recent.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {eventText(event)}
                </p>
                <p className="text-xs text-slate-400">
                  {timeAgo(event.createdAt)}
                </p>
              </div>
              {event.xp > 0 ? (
                <span className="text-sm font-bold text-amber-600">
                  +{event.xp}
                </span>
              ) : null}
            </li>
          ))}
          {data.recent.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nothing yet – play your first mission!
            </p>
          ) : null}
        </ul>
      )}

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm">
        <Link
          href="/settings/profile"
          className="flex min-h-14 items-center gap-3 px-4 text-sm font-semibold text-slate-800"
        >
          <UserRound className="h-5 w-5 text-slate-500" />{" "}
          <span className="flex-1">Edit profile</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>
        <Link
          href="/settings/notifications"
          className="flex min-h-14 items-center gap-3 px-4 text-sm font-semibold text-slate-800"
        >
          <Bell className="h-5 w-5 text-slate-500" />{" "}
          <span className="flex-1">Notifications</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex min-h-14 w-full items-center gap-3 px-4 text-sm font-semibold text-rose-700"
        >
          <LogOut className="h-5 w-5" /> Sign out
        </button>
      </div>

      {goalOpen ? (
        <GoalSheet me={data} onClose={() => setGoalOpen(false)} />
      ) : null}
      {badge ? (
        <Sheet title={badge.title} onClose={() => setBadge(null)}>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span
              className={cn(
                "text-6xl",
                badge.earned ? "game-pop" : "opacity-30 grayscale",
              )}
            >
              {badge.emoji}
            </span>
            <p className="text-slate-700">{badge.description}</p>
            {badge.earned ? (
              <p className="text-sm font-semibold text-emerald-700">
                Earned{" "}
                {badge.earnedAt
                  ? new Date(badge.earnedAt).toLocaleDateString()
                  : ""}
              </p>
            ) : (
              <div className="w-full max-w-xs">
                <ProgressBar value={(badge.value / badge.target) * 100} />
                <p className="mt-1 text-sm text-slate-500">
                  {badge.value} / {badge.target}
                </p>
              </div>
            )}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-lg font-black text-slate-900">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}
