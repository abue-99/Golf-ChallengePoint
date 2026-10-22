import { cn } from "@/lib/utils";

export type ActivityDayState = "done" | "missed" | "planned" | "none";
export type ActivityDay = { date: string; state: ActivityDayState };

export const ACTIVITY_META: Record<
  ActivityDayState,
  { label: string; className: string }
> = {
  done: { label: "Completed", className: "bg-green-600 border-green-600" },
  missed: { label: "Missed", className: "bg-rose-400 border-rose-400" },
  planned: { label: "Planned", className: "bg-white border-slate-400" },
  none: { label: "Nothing scheduled", className: "bg-slate-200 border-slate-200" },
};

function formatDay(date: string, style: "short" | "long") {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : "narrow",
    ...(style === "long" ? { day: "numeric", month: "short" } : {}),
  }).format(value);
}

/** One dot per day; the dot for today carries a ring. */
export default function ActivityStrip({
  days,
  today,
  size = "sm",
  className,
}: {
  days: ActivityDay[];
  today: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  if (days.length === 0) return null;
  const summary = days
    .map((day) => `${formatDay(day.date, "long")}: ${ACTIVITY_META[day.state].label}`)
    .join(", ");

  return (
    <div
      className={cn("flex items-end", size === "lg" ? "gap-1.5" : "gap-[3px]", className)}
      role="img"
      aria-label={`Activity: ${summary}`}
    >
      {days.map((day) => {
        const isToday = day.date === today;
        return (
          <span key={day.date} className="flex flex-col items-center gap-1">
            {size === "lg" ? (
              <span className={cn("text-[10px] leading-none", isToday ? "font-semibold text-slate-800" : "text-slate-400")}>
                {formatDay(day.date, "short")}
              </span>
            ) : null}
            <span
              title={`${formatDay(day.date, "long")}: ${ACTIVITY_META[day.state].label}`}
              className={cn(
                "block rounded-full border",
                size === "lg" ? "h-3.5 w-3.5" : "h-2 w-2",
                ACTIVITY_META[day.state].className,
                isToday && "ring-2 ring-[var(--golf-primary)] ring-offset-1",
              )}
            />
          </span>
        );
      })}
    </div>
  );
}

export function ActivityLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 text-xs text-slate-500", className)}>
      {(["done", "missed", "planned"] as const).map((state) => (
        <span key={state} className="inline-flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-full border", ACTIVITY_META[state].className)} />
          {ACTIVITY_META[state].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full ring-2 ring-[var(--golf-primary)] ring-offset-1 bg-slate-200" />
        Today
      </span>
    </div>
  );
}
