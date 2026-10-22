"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CheckCheck, ExternalLink, Loader2, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatDateTime,
  initialsOf,
  nameOf,
  type FeedbackItem,
} from "@/lib/coach-roster";

async function fetchFeedback(playerId?: string): Promise<FeedbackItem[]> {
  const query = playerId ? `?playerId=${encodeURIComponent(playerId)}` : "";
  const res = await fetch(`/api/coach/roster/feedback${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Completed lessons waiting for the coach to look at them, with the player's
 * self-assessment and notes. Used in the feedback sheet and the player panel.
 */
export function FeedbackList({
  playerId,
  timeZone,
  showPlayer = true,
  onChanged,
  emptyText = "Nothing waiting for your feedback.",
}: {
  playerId?: string;
  timeZone: string;
  showPlayer?: boolean;
  onChanged?: () => void;
  emptyText?: string;
}) {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFeedback(playerId)
      .then((next) => {
        if (cancelled) return;
        setItems(next);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  async function markSeen(id: string | "all") {
    setBusyId(id);
    const res = await fetch(
      id === "all"
        ? "/api/coach/roster/feedback/seen"
        : `/api/coach/roster/feedback/${encodeURIComponent(id)}/seen`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id === "all" && playerId ? { playerId } : {}),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error("Could not update the feedback list.");
      return;
    }
    setItems((prev) => (id === "all" ? [] : (prev ?? []).filter((item) => item.id !== id)));
    onChanged?.();
  }

  if (failed && !items) {
    return <p className="text-sm text-rose-700">Feedback could not be loaded.</p>;
  }
  if (!items) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {items.length > 1 ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void markSeen("all")}
            disabled={busyId !== null}
            className="gap-1.5 text-slate-600"
          >
            <CheckCheck className="h-4 w-4" /> Mark all as seen
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-3">
              {showPlayer && item.player ? (
                <Avatar className="h-8 w-8 shrink-0">
                  {item.player.profileImage ? (
                    <AvatarImage src={item.player.profileImage} alt={nameOf(item.player)} />
                  ) : null}
                  <AvatarFallback className="bg-gray-200 text-xs text-gray-600">
                    {initialsOf(item.player)}
                  </AvatarFallback>
                </Avatar>
              ) : null}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm">
                  {showPlayer && item.player ? (
                    <span className="font-medium text-slate-800">{nameOf(item.player)} · </span>
                  ) : null}
                  <span className="text-slate-700">{item.lesson.name}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Completed{" "}
                  {item.completedAt
                    ? formatDateTime(item.completedAt, {
                        timeZone,
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })
                    : ""}
                  {item.plan ? ` · ${item.plan.name}` : ""}
                </p>
                {item.selfAssessment != null ? (
                  <p className="text-xs text-slate-600">
                    Self-assessment{" "}
                    <span className="font-semibold text-slate-800">{item.selfAssessment}/10</span>
                  </p>
                ) : null}
                {item.playerNotes ? (
                  <p className="flex gap-1.5 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                    <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="whitespace-pre-line">{item.playerNotes}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              {showPlayer && item.player ? (
                <Button variant="ghost" size="sm" asChild className="text-slate-600">
                  <Link
                    href={`/coach/players/${item.player.id}`}
                    className="inline-flex flex-row items-center gap-1.5"
                  >
                    <ExternalLink className="h-4 w-4" /> Player
                  </Link>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void markSeen(item.id)}
                disabled={busyId !== null}
                className="gap-1.5"
              >
                {busyId === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Seen
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FeedbackSheet({
  timeZone,
  onClose,
  onChanged,
}: {
  timeZone: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-100 p-5 pr-12">
          <SheetTitle>Awaiting your feedback</SheetTitle>
          <SheetDescription>
            Lessons your players completed since you last looked. Mark them as seen once
            you have reviewed them.
          </SheetDescription>
        </SheetHeader>
        <div className="p-5">
          <FeedbackList timeZone={timeZone} onChanged={onChanged} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
