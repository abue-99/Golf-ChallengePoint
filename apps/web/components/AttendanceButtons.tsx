"use client";

import { useState } from "react";
import { Check, HelpCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_LABEL,
  respondAttendance,
  type AttendanceStatus,
} from "@/lib/attendance";
import type { CalendarActivity } from "@/types/calendar";

const OPTIONS: {
  status: AttendanceStatus;
  icon: typeof Check;
  active: string;
}[] = [
  {
    status: "GOING",
    icon: Check,
    active: "border-emerald-600 bg-emerald-600 text-white",
  },
  {
    status: "MAYBE",
    icon: HelpCircle,
    active: "border-amber-500 bg-amber-500 text-white",
  },
  {
    status: "NOT_GOING",
    icon: X,
    active: "border-rose-600 bg-rose-600 text-white",
  },
];

/**
 * "Going / Maybe / Can't make it" for one team training or team event.
 * Big touch targets (iPhone). For maybe and can't-make-it the player can add
 * a short reason the coach sees.
 */
export default function AttendanceButtons({
  activity,
  onSaved,
  compact = false,
}: {
  activity: CalendarActivity;
  onSaved?: (answer: { status: AttendanceStatus; note: string | null }) => void;
  compact?: boolean;
}) {
  const [answer, setAnswer] = useState(activity.attendance ?? null);
  const [busy, setBusy] = useState<AttendanceStatus | null>(null);
  const [note, setNote] = useState(activity.attendance?.note ?? "");
  const [noteOpen, setNoteOpen] = useState(false);

  async function save(status: AttendanceStatus, withNote?: string | null) {
    setBusy(status);
    try {
      const saved = await respondAttendance(activity, status, withNote ?? null);
      const next = { status: saved.status, note: saved.note };
      setAnswer(next);
      onSaved?.(next);
      if (status === "GOING") {
        setNoteOpen(false);
        toast.success("See you there!");
      } else {
        // Ask for a reason right after the tap, but never require it.
        setNoteOpen(true);
        toast.success("Your coach has been told.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Your answer could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div
        className="grid grid-cols-3 gap-2"
        role="group"
        aria-label="Your answer"
      >
        {OPTIONS.map(({ status, icon: Icon, active }) => {
          const selected = answer?.status === status;
          return (
            <button
              key={status}
              type="button"
              disabled={busy !== null}
              aria-pressed={selected}
              onClick={() =>
                void save(status, status === "GOING" ? null : note || null)
              }
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition-colors",
                selected
                  ? active
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                busy !== null && "opacity-70",
              )}
            >
              {busy === status ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="truncate">{ATTENDANCE_LABEL[status]}</span>
            </button>
          );
        })}
      </div>

      {answer && answer.status !== "GOING" && noteOpen ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save(answer.status, note.trim() || null);
          }}
        >
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="Reason for your coach (optional)"
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-base sm:text-sm"
            aria-label="Reason for your coach"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="h-11 shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            Send
          </button>
        </form>
      ) : answer?.note && answer.status !== "GOING" ? (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="text-left text-xs text-slate-500 underline-offset-2 hover:underline"
        >
          Your note: “{answer.note}” · change
        </button>
      ) : null}
    </div>
  );
}
