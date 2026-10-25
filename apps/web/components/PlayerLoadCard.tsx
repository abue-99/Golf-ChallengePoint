"use client";

import { useState } from "react";
import { AlertTriangle, Copy, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  formatMinutes,
  KIND_LABEL,
  setLoadLimit,
  type LoadKind,
  type PlayerLoad,
} from "@/lib/player-load";

const COACH_COLORS = ["#2563eb", "#9333ea", "#ea580c", "#0891b2", "#db2777"];
const YOU_COLOR = "var(--golf-primary, #16a34a)";
const LIMIT_OPTIONS = [4, 6, 8, 10, 12, 15, 20];

/**
 * Training load of a player across all coaches: this week and next week as
 * a bar per coach against the weekly limit, lessons two coaches gave the
 * same player, and the limit itself.
 */
export default function PlayerLoadCard({
  load,
  defaultLimit,
  playerName,
}: {
  load: PlayerLoad;
  defaultLimit: number;
  playerName: string;
}) {
  const [saving, setSaving] = useState(false);
  // Same colour for the same coach in both weeks.
  const colorByCoach = new Map<string, string>();
  for (const week of load.weeks) {
    for (const entry of week.byCoach) {
      const key = entry.coachId ?? "?";
      if (colorByCoach.has(key)) continue;
      colorByCoach.set(
        key,
        entry.name === "You"
          ? YOU_COLOR
          : COACH_COLORS[colorByCoach.size % COACH_COLORS.length],
      );
    }
  }
  const scale = Math.max(
    load.limit * 1.25,
    ...load.weeks.map((week) => week.minutes),
  );

  const changeLimit = async (value: string) => {
    setSaving(true);
    try {
      await setLoadLimit(load.playerId, value ? Number(value) * 60 : null);
      toast.success(
        value
          ? `Weekly limit for ${playerName}: ${value} h`
          : `${playerName} uses the default limit again.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      {load.weeks.map((week, index) => {
        const kinds = (Object.keys(week.byKind) as LoadKind[]).filter(
          (kind) => week.byKind[kind] > 0,
        );
        return (
          <div key={week.start} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-slate-800">
                {index === 0 ? "This week" : "Next week"}
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  week.level === "over"
                    ? "font-semibold text-rose-700"
                    : week.level === "high"
                      ? "font-medium text-amber-700"
                      : "text-slate-600",
                )}
              >
                {formatMinutes(week.minutes)}{" "}
                <span className="font-normal text-slate-400">
                  / {formatMinutes(load.limit)}
                </span>
              </span>
            </div>
            <div
              className="relative h-3 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={`${formatMinutes(week.minutes)} of ${formatMinutes(load.limit)}`}
            >
              <div className="flex h-full">
                {week.byCoach.map((entry) => (
                  <span
                    key={entry.coachId ?? "?"}
                    className="h-full first:rounded-l-full"
                    style={{
                      width: `${(entry.minutes / scale) * 100}%`,
                      backgroundColor: colorByCoach.get(entry.coachId ?? "?"),
                    }}
                  />
                ))}
              </div>
              <span
                className="absolute top-0 h-full w-0.5 bg-slate-900/70"
                style={{ left: `${(load.limit / scale) * 100}%` }}
                aria-hidden
              />
            </div>
            {week.minutes > 0 || week.tournamentDays > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                {week.byCoach.map((entry) => (
                  <span
                    key={entry.coachId ?? "?"}
                    className="inline-flex items-center gap-1"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: colorByCoach.get(entry.coachId ?? "?"),
                      }}
                    />
                    {entry.name} {formatMinutes(entry.minutes)}
                  </span>
                ))}
                {week.tournamentDays > 0 ? (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <Trophy className="h-3 w-3" />
                    {week.tournamentDays} tournament day
                    {week.tournamentDays === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Nothing planned.</p>
            )}
            {kinds.length > 0 ? (
              <p className="text-[11px] text-slate-400">
                {kinds
                  .map(
                    (kind) =>
                      `${KIND_LABEL[kind]} ${formatMinutes(week.byKind[kind])}`,
                  )
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        );
      })}

      {load.duplicates.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <Copy className="h-3.5 w-3.5" /> Same lesson from more than one
            coach
          </p>
          <ul className="space-y-0.5">
            {load.duplicates.map((duplicate) => (
              <li key={duplicate.lessonId}>
                {duplicate.lessonName}{" "}
                <span className="text-amber-700">
                  – {duplicate.coaches.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {load.weeks.some((week) => week.level === "over") ? (
        <p className="flex items-start gap-1.5 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Above the weekly limit – talk to the other coaches before adding more.
        </p>
      ) : null}

      <label className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-slate-600">
        Weekly limit
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm pointer-coarse:h-11"
          value={load.customLimit ? String(load.customLimit / 60) : ""}
          disabled={saving}
          onChange={(event) => void changeLimit(event.target.value)}
        >
          <option value="">Default ({formatMinutes(defaultLimit)})</option>
          {LIMIT_OPTIONS.map((hours) => (
            <option key={hours} value={String(hours)}>
              {hours} h
            </option>
          ))}
          {load.customLimit &&
          !LIMIT_OPTIONS.includes(load.customLimit / 60) ? (
            <option value={String(load.customLimit / 60)}>
              {formatMinutes(load.customLimit)}
            </option>
          ) : null}
        </select>
      </label>
    </div>
  );
}
