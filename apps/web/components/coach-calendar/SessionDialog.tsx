"use client";

import type { ReactNode } from "react";
import { MapPin, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TeamIcon from "@/components/TeamIcon";
import type { CoachCalendarActivity } from "@/types/coach-calendar";
import AttendancePanel from "./AttendancePanel";
import { formatRange, TYPE_LABEL } from "./shared";

/** "Cancelled" / "Moved from …" with the coach's note. */
export function OccurrenceNotice({
  activity,
}: {
  activity: Pick<
    CoachCalendarActivity,
    | "occurrenceStatus"
    | "originalStart"
    | "originalEnd"
    | "changeReason"
    | "recurrence"
  >;
}) {
  const cancelled = activity.occurrenceStatus === "cancelled";
  return (
    <div
      className={
        cancelled
          ? "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900"
          : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      }
    >
      <p className="font-semibold">
        {cancelled
          ? "This date is cancelled"
          : activity.originalStart
            ? `Moved from ${formatRange(activity.originalStart, activity.originalEnd ?? activity.originalStart)}`
            : "Moved"}
      </p>
      {activity.changeReason ? (
        <p className="mt-0.5 whitespace-pre-wrap">{activity.changeReason}</p>
      ) : null}
      {activity.recurrence && activity.recurrence !== "NONE" ? (
        <p className="mt-0.5 text-xs opacity-80">
          The rest of the series is unchanged.
        </p>
      ) : null}
    </div>
  );
}

const RECURRENCE_LABEL: Record<string, string> = {
  DAILY: "Every day",
  WEEKLY: "Every week",
  MONTHLY: "Every month",
};

/** Details of one calendar entry; team sessions show the players' answers. */
export default function SessionDialog({
  activity,
  onClose,
  actions,
  footnote,
}: {
  activity: CoachCalendarActivity | null;
  onClose: () => void;
  /** Buttons shown at the bottom (edit, remind …). */
  actions?: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <Dialog
      open={Boolean(activity)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        {activity ? (
          <>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <DialogHeader>
                  <DialogTitle>{activity.title}</DialogTitle>
                </DialogHeader>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 pointer-coarse:h-11 pointer-coarse:w-11"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm text-slate-600">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 uppercase tracking-wide text-slate-600">
                  {TYPE_LABEL[activity.type]}
                </span>
                {activity.teamName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                    {activity.teamIcon ? (
                      <TeamIcon icon={activity.teamIcon} size={14} />
                    ) : (
                      <Users className="h-3.5 w-3.5" />
                    )}
                    {activity.teamName}
                  </span>
                ) : null}
                {activity.playerName ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                    {activity.playerName}
                  </span>
                ) : null}
                {activity.recurrence &&
                RECURRENCE_LABEL[activity.recurrence] ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                    {RECURRENCE_LABEL[activity.recurrence]}
                  </span>
                ) : null}
                {activity.type === "coach-assignment" && activity.status ? (
                  <span
                    className={
                      activity.status === "COMPLETED"
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"
                        : "rounded-full bg-blue-50 px-2.5 py-1 text-blue-700"
                    }
                  >
                    {activity.status === "COMPLETED" ? "Completed" : "Planned"}
                  </span>
                ) : null}
              </div>

              <p
                className={
                  activity.occurrenceStatus === "cancelled"
                    ? "font-medium text-slate-500 line-through"
                    : "font-medium text-slate-800"
                }
              >
                {formatRange(activity.start, activity.end)}
              </p>
              {activity.occurrenceStatus ? (
                <OccurrenceNotice activity={activity} />
              ) : null}
              {activity.location ? (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {activity.location}
                </p>
              ) : null}
              {activity.createdByName &&
              (activity.type === "team-event" ||
                activity.type === "coach-assignment") ? (
                <p className="text-xs text-slate-500">
                  Planned by {activity.createdByName}
                </p>
              ) : null}
              {activity.description ? (
                <p className="whitespace-pre-wrap">{activity.description}</p>
              ) : null}

              {activity.attendance ? (
                <section className="rounded-xl border border-slate-200 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">
                    Attendance
                  </h3>
                  <AttendancePanel attendance={activity.attendance} />
                </section>
              ) : null}

              {footnote}
              {actions ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                  {actions}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
