"use client";

import { useState } from "react";
import { Loader2, MessageSquareQuote, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FEELINGS } from "@/lib/game";
import { Sheet, Stars } from "@/components/game/bits";

export type ReviewTarget = {
  assignmentId: string;
  lessonName: string;
  playerName: string;
  selfAssessment?: number | null;
  notes?: string | null;
  stars?: number | null;
  resultScore?: number | null;
  targetScore?: number | null;
  targetAttempts?: number | null;
  practiceMinutes?: number | null;
  current?: { rating: number; comment: string | null; pick: boolean } | null;
};

const QUICK = [
  "Great work! 💪",
  "Nice progress – keep going.",
  "Let's look at this together next session.",
];

/** Coach gives feedback back: 1–5 stars, comment, "coach's pick". */
export function ReviewDialog({
  target,
  onClose,
  onSaved,
}: {
  target: ReviewTarget;
  onClose: () => void;
  onSaved?: (review: {
    rating: number;
    comment: string | null;
    pick: boolean;
  }) => void;
}) {
  const [rating, setRating] = useState(target.current?.rating ?? 0);
  const [comment, setComment] = useState(target.current?.comment ?? "");
  const [pick, setPick] = useState(target.current?.pick ?? false);
  const [busy, setBusy] = useState(false);
  const feeling = FEELINGS.reduce<(typeof FEELINGS)[number] | null>(
    (best, option) =>
      target.selfAssessment == null
        ? null
        : !best ||
            Math.abs(option.value - target.selfAssessment) <
              Math.abs(best.value - target.selfAssessment)
          ? option
          : best,
    null,
  );

  async function save() {
    if (rating < 1) {
      toast.error("Choose 1–5 stars");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/coach/roster/assignments/${encodeURIComponent(target.assignmentId)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating,
            comment: comment.trim() || null,
            pick,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.message ?? "Could not save the review");
      toast.success(`Review sent to ${target.playerName}`);
      onSaved?.({ rating, comment: comment.trim() || null, pick });
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save the review",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={`Review · ${target.playerName}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {target.current ? "Update review" : "Send review"}
        </button>
      }
    >
      <p className="font-semibold text-slate-900">{target.lessonName}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
        {target.stars ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            Mission <Stars value={target.stars} size={12} />
          </span>
        ) : null}
        {target.resultScore != null && target.targetScore ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            Result {target.resultScore}
            {target.targetAttempts
              ? `/${target.targetAttempts}`
              : ""} (goal {target.targetScore})
          </span>
        ) : null}
        {target.practiceMinutes ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            {target.practiceMinutes} min
          </span>
        ) : null}
        {feeling ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            Felt {feeling.emoji} {target.selfAssessment}/10
          </span>
        ) : null}
      </div>
      {target.notes ? (
        <p className="mt-3 flex gap-1.5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span className="whitespace-pre-line">{target.notes}</span>
        </p>
      ) : null}

      <p className="mt-5 text-sm font-semibold text-slate-700">Your rating</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            onClick={() => setRating(value)}
            className="flex h-12 w-12 items-center justify-center rounded-xl active:scale-90"
          >
            <Star
              className={cn(
                "h-8 w-8",
                value <= rating
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-300",
              )}
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Your stars shape the player card and give the player bonus XP.
      </p>

      <label
        htmlFor="review-comment"
        className="mt-5 block text-sm font-semibold text-slate-700"
      >
        Comment
      </label>
      <textarea
        id="review-comment"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What was good? What next?"
        className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-base outline-none focus:border-emerald-500"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() =>
              setComment((current) => (current ? `${current} ${text}` : text))
            }
            className="min-h-9 rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700"
          >
            {text}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPick((value) => !value)}
        aria-pressed={pick}
        className={cn(
          "mt-5 flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 text-left text-sm font-semibold",
          pick
            ? "border-amber-400 bg-amber-50 text-amber-900"
            : "border-slate-200 text-slate-600",
        )}
      >
        <span className="text-xl">🏅</span>
        <span className="flex-1">
          Coach&apos;s pick
          <span className="block text-xs font-normal text-slate-500">
            Highlight in the team feed, +20 XP and a badge
          </span>
        </span>
        <span
          className={cn(
            "h-6 w-11 rounded-full p-0.5 transition-colors",
            pick ? "bg-amber-400" : "bg-slate-300",
          )}
        >
          <span
            className={cn(
              "block h-5 w-5 rounded-full bg-white transition-transform",
              pick ? "translate-x-5" : "",
            )}
          />
        </span>
      </button>
    </Sheet>
  );
}
