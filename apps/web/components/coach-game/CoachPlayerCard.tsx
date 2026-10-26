"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Loader2 } from "lucide-react";
import type { LevelInfo, PlayerCard } from "@/lib/game";
import { AttributeList, SkillRadar } from "@/components/game/PlayerCardView";
import { TIER_STYLE } from "@/lib/game";
import { cn } from "@/lib/utils";

type CardData = {
  level: LevelInfo;
  week: {
    goal: number;
    days: number;
    weekStreak: number;
    bestWeekStreak: number;
  };
  card: PlayerCard;
  badges: {
    key: string;
    title: string;
    emoji: string;
    earnedAt: string | null;
  }[];
};

/**
 * Player card for coaches: level, weekly streak, skills from real results
 * (coach reviews, benchmark tests, mission stars, self-assessments).
 */
export default function CoachPlayerCard({
  playerId,
  journeyHref,
  showList = false,
}: {
  playerId: string;
  journeyHref?: string;
  showList?: boolean;
}) {
  const [data, setData] = useState<CardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/coach/roster/players/${encodeURIComponent(playerId)}/card`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as CardData;
      })
      .then((next) => !cancelled && setData(next))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (failed && !data)
    return <p className="text-sm text-slate-500">Player card not available.</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading player card…
      </p>
    );
  }
  const tier = TIER_STYLE[data.card.tier];
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-gradient-to-br shadow",
            tier.card,
            tier.text,
          )}
        >
          <span className="text-xl font-black">{data.card.ovr ?? "–"}</span>
          <span className="text-[9px] font-bold uppercase">OVR</span>
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-slate-900">
            Level {data.level.level} · {tier.label}
          </p>
          <p className="flex items-center gap-1 text-slate-600">
            <Flame className="h-4 w-4 text-orange-500" /> {data.week.weekStreak}
            -week streak · this week {data.week.days}/{data.week.goal} days
          </p>
          <p className="truncate">
            {data.badges
              .slice(-8)
              .map((badge) => badge.emoji)
              .join(" ")}
          </p>
        </div>
      </div>
      <SkillRadar card={data.card} size={260} />
      {showList ? <AttributeList card={data.card} /> : null}
      <p className="text-xs text-slate-400">
        Only real data: your reviews (stars), benchmark tests, mission stars and
        self-assessments.
      </p>
      {journeyHref ? (
        <Link
          href={journeyHref}
          className="text-sm font-semibold text-[var(--golf-primary)] hover:underline"
        >
          Go to journey →
        </Link>
      ) : null}
    </section>
  );
}
