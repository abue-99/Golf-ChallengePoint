"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusMeta, personName, timeAgo, type Person } from "@/lib/game";
import { PersonAvatar, Stars } from "@/components/game/bits";
import { ReviewDialog, type ReviewTarget } from "./ReviewDialog";

type FeedItem = {
  id: string;
  type: string;
  title: string | null;
  xp: number;
  meta: Record<string, unknown> | null;
  createdAt: string;
  player: Person;
  actor: Person | null;
  unread: boolean;
  lesson: {
    assignmentId: string;
    mine: boolean;
    selfAssessment: number | null;
    notes: string | null;
    stars: number | null;
    resultScore: number | null;
    targetScore: number | null;
    targetAttempts: number | null;
    reviewed: boolean;
    stillCompleted: boolean;
  } | null;
};

type FeedPage = { unread: number; hasMore: boolean; items: FeedItem[] };

const ATTENDANCE: Record<string, string> = {
  GOING: "✓ going",
  MAYBE: "? maybe",
  NOT_GOING: "✗ can't make it",
};

function describe(item: FeedItem) {
  const meta = item.meta ?? {};
  const title = item.title ?? "";
  switch (item.type) {
    case "LESSON_COMPLETED":
      return {
        icon: focusMeta(meta.focusArea as string).emoji,
        text: (
          <>
            completed <b>{title}</b>
          </>
        ),
      };
    case "LESSON_STARTED":
      return {
        icon: "▶️",
        text: (
          <>
            started <b>{title}</b>
          </>
        ),
      };
    case "BLOCK_COMPLETED":
      return {
        icon: "🎁",
        text: (
          <>
            finished the block <b>{title}</b>
          </>
        ),
      };
    case "JOURNEY_COMPLETED":
      return {
        icon: "🏁",
        text: (
          <>
            finished the journey <b>{title}</b>
          </>
        ),
      };
    case "JOURNEY_ACCEPTED":
      return {
        icon: "🗺️",
        text: (
          <>
            accepted the journey <b>{title}</b>
          </>
        ),
      };
    case "SESSION_COMPLETED":
      return {
        icon: "📅",
        text: (
          <>
            ticked off <b>{title}</b>
          </>
        ),
      };
    case "ATTENDANCE_ANSWERED":
      return {
        icon: "👥",
        text: (
          <>
            {ATTENDANCE[String(meta.status)] ?? "answered"} for <b>{title}</b>
            {meta.team ? ` (${String(meta.team)})` : ""}
          </>
        ),
      };
    case "QUESTION_ANSWERED":
      return {
        icon: "💬",
        text: (
          <>
            answered {item.actor?.firstName ?? "a coach"}&apos;s question “
            {title}”
          </>
        ),
      };
    case "COACH_REVIEW":
      return {
        icon: meta.pick ? "🏅" : "⭐",
        text: (
          <>
            got a review from <b>{personName(item.actor) || "a coach"}</b> for{" "}
            {title} ({String(meta.rating)}★)
          </>
        ),
      };
    case "CHALLENGE_ENTRY":
      return {
        icon: "⚔️",
        text: (
          <>
            posted {String(meta.best ?? "")} {String(meta.unit ?? "")} in{" "}
            <b>{title}</b>
          </>
        ),
      };
    case "BADGE_EARNED":
      return {
        icon: "🏆",
        text: (
          <>
            earned the badge <b>{title}</b>
          </>
        ),
      };
    case "WEEK_GOAL":
      return { icon: "🔥", text: <>reached the weekly goal</> };
    case "NOTE_MENTION":
      return {
        icon: "@",
        text: (
          <>
            <b>{personName(item.actor) || "A coach"}</b> mentioned you: “{title}
            ”
          </>
        ),
      };
    case "HANDOVER":
      return {
        icon: "🤝",
        text: (
          <>
            Handover from <b>{personName(item.actor) || "a coach"}</b>: “{title}
            ”
          </>
        ),
      };
    case "LEAGUE_PODIUM":
      return { icon: "🥇", text: <>{title}</> };
    default:
      return { icon: "•", text: <>{title}</> };
  }
}

/**
 * "Recent activity" of all players the coach works with – the same feed for
 * every coach of a player, so assistants see reviews of the head coach.
 */
export default function ActivityFeed({
  playerId,
  limit = 8,
  compact = false,
  onOpenPlayer,
}: {
  playerId?: string;
  limit?: number;
  compact?: boolean;
  onOpenPlayer?: (playerId: string) => void;
}) {
  const [page, setPage] = useState<FeedPage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reviewing, setReviewing] = useState<ReviewTarget | null>(null);
  const markedSeen = useRef(false);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (playerId) query.set("playerId", playerId);
    const res = await fetch(`/api/coach/roster/feed?${query}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as FeedPage;
  }, [limit, playerId]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setPage(data))
      .catch(() => !cancelled && setFailed(true));
    const timer = window.setInterval(() => {
      load()
        .then((data) => !cancelled && setPage(data))
        .catch(() => null);
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [load]);

  // Seen once the coach has looked at the home feed for a moment.
  useEffect(() => {
    if (!page || playerId || markedSeen.current || page.unread === 0) return;
    const timer = window.setTimeout(() => {
      markedSeen.current = true;
      void fetch("/api/coach/roster/feed/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [page, playerId]);

  async function more() {
    if (!page?.items.length) return;
    setLoadingMore(true);
    try {
      const last = page.items[page.items.length - 1];
      const query = new URLSearchParams({
        limit: "20",
        before: last.createdAt,
      });
      if (playerId) query.set("playerId", playerId);
      const res = await fetch(`/api/coach/roster/feed?${query}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const next = (await res.json()) as FeedPage;
        setPage({
          ...page,
          hasMore: next.hasMore,
          items: [...page.items, ...next.items],
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }

  if (failed && !page)
    return (
      <p className="text-sm text-rose-700">Activity could not be loaded.</p>
    );
  if (!page) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
      </p>
    );
  }

  const body =
    page.items.length === 0 ? (
      <p className="px-1 py-2 text-sm text-slate-500">
        Nothing yet. As soon as your players play missions, it shows up here.
      </p>
    ) : (
      <ul className="divide-y divide-slate-100">
        {page.items.map((item) => {
          const { icon, text } = describe(item);
          const lesson = item.lesson;
          const canReview = lesson && !lesson.reviewed && lesson.stillCompleted;
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-start gap-3 py-2.5",
                item.unread ? "" : "opacity-90",
              )}
            >
              {compact ? (
                <span className="mt-0.5 text-lg">{icon}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenPlayer?.(item.player.id)}
                  className="relative shrink-0"
                >
                  <PersonAvatar person={item.player} size={36} />
                  <span className="absolute -bottom-1 -right-1 text-sm">
                    {icon}
                  </span>
                </button>
              )}
              <div className="min-w-0 flex-1 text-sm text-slate-700">
                <p>
                  {!compact ? (
                    <span className="font-semibold text-slate-900">
                      {item.type === "NOTE_MENTION" || item.type === "HANDOVER"
                        ? `About ${personName(item.player)} · `
                        : `${personName(item.player)} `}
                    </span>
                  ) : null}
                  {text}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {item.unread ? (
                    <span
                      className="h-2 w-2 rounded-full bg-emerald-500"
                      aria-label="New"
                    />
                  ) : null}
                  {timeAgo(item.createdAt)}
                  {lesson?.stars ? (
                    <Stars value={lesson.stars} size={11} />
                  ) : null}
                  {lesson?.selfAssessment ? (
                    <span>felt {lesson.selfAssessment}/10</span>
                  ) : null}
                  {lesson?.resultScore != null && lesson.targetScore ? (
                    <span>
                      result {lesson.resultScore}/
                      {lesson.targetAttempts ?? lesson.targetScore}
                    </span>
                  ) : null}
                </p>
                {lesson?.notes ? (
                  <p className="mt-1 line-clamp-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">
                    “{lesson.notes}”
                  </p>
                ) : null}
              </div>
              {canReview ? (
                <button
                  type="button"
                  onClick={() =>
                    setReviewing({
                      assignmentId: lesson.assignmentId,
                      lessonName: item.title ?? "Lesson",
                      playerName: personName(item.player),
                      selfAssessment: lesson.selfAssessment,
                      notes: lesson.notes,
                      stars: lesson.stars,
                      resultScore: lesson.resultScore,
                      targetScore: lesson.targetScore,
                      targetAttempts: lesson.targetAttempts,
                    })
                  }
                  className="flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 pointer-coarse:min-h-11"
                >
                  <Star className="h-3.5 w-3.5" /> Review
                </button>
              ) : lesson?.reviewed ? (
                <span className="shrink-0 text-xs font-semibold text-sky-700">
                  Reviewed
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    );

  return (
    <div>
      {body}
      {page.hasMore ? (
        <button
          type="button"
          onClick={() => void more()}
          disabled={loadingMore}
          className="mt-1 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{" "}
          Show more
        </button>
      ) : null}
      {reviewing ? (
        <ReviewDialog
          target={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() =>
            void load()
              .then(setPage)
              .catch(() => null)
          }
        />
      ) : null}
    </div>
  );
}

/** Card for coach home with header and unread count. */
export function ActivityFeedCard({
  onOpenPlayer,
}: {
  onOpenPlayer?: (playerId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-[var(--golf-heading)]">
        <Activity className="h-4 w-4 text-emerald-600" /> Recent activity
      </h2>
      <p className="mb-2 text-xs text-slate-500">
        What your players did – shared with every coach of the player.
      </p>
      <ActivityFeed onOpenPlayer={onOpenPlayer} limit={5} />
    </section>
  );
}
