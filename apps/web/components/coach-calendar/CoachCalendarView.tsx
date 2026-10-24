"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import { CalendarClock, Users, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeamIcon from "@/components/TeamIcon";
import { cn } from "@/lib/utils";
import {
  loadCalendarViewPreference,
  saveCalendarViewPreference,
  type CalendarView,
} from "@/lib/calendar-view-preference";
import {
  VISIBLE_DAY_END_TIME,
  VISIBLE_DAY_START_TIME,
} from "@/lib/calendar-visible-hours";
import type { CalendarActivity } from "@/types/calendar";
import type {
  CoachCalendarActivity,
  CoachCalendarPayload,
  CoachCalendarTeam,
} from "@/types/coach-calendar";
import { AttendanceCounts } from "./AttendancePanel";
import SessionDialog from "./SessionDialog";
import {
  formatDay,
  formatTime,
  hasOpenAnswers,
  isTeamSession,
  localDayKey,
  NEUTRAL_COLOR,
  teamColors,
  type TeamColor,
} from "./shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const AGENDA_DAYS = 28;
const UPCOMING_DAYS = 14;
const FC_VIEW: Record<Exclude<CalendarView, "agenda">, string> = {
  day: "timeGridDay",
  week: "timeGridWeek",
  month: "dayGridMonth",
};
const TEAM_FILTER_KEY = "coach-calendar:team";

type PlayerOption = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
};

function playerName(player: PlayerOption) {
  return (
    [player.firstName, player.lastName].filter(Boolean).join(" ") || "Player"
  );
}

/** Agenda is not a FullCalendar view: it always shows the next four weeks. */
function agendaRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  return { from, to: new Date(from.getTime() + AGENDA_DAYS * DAY_MS) };
}

function readStored(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage is a convenience only.
  }
}

async function fetchCoachCalendar(from: Date, to: Date, teamId: string | null) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  if (teamId) params.set("teamId", teamId);
  const res = await fetch(`/api/calendar/coach?${params}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        `Calendar could not be loaded (${res.status})`,
    );
  }
  return data as CoachCalendarPayload;
}

function colorFor(
  activity: CoachCalendarActivity,
  colors: Map<string, TeamColor>,
) {
  return (activity.teamId && colors.get(activity.teamId)) || NEUTRAL_COLOR;
}

export function toEventInput(
  activity: CoachCalendarActivity,
  colors: Map<string, TeamColor>,
): EventInput {
  const color = colorFor(activity, colors);
  const base = {
    id: activity.id,
    title: activity.title,
    start: activity.start,
    end: activity.end,
    allDay: activity.allDay,
    extendedProps: { activity },
  };
  switch (activity.type) {
    case "team-practice":
      return {
        ...base,
        backgroundColor: color.soft,
        borderColor: color.solid,
        textColor: color.text,
        classNames: ["coach-cal-practice"],
      };
    case "team-event":
      return {
        ...base,
        backgroundColor: color.solid,
        borderColor: color.solid,
        textColor: "#ffffff",
        classNames: ["coach-cal-event"],
      };
    case "coach-assignment":
      return {
        ...base,
        backgroundColor:
          activity.status === "COMPLETED" ? "#ecfdf5" : "#eff6ff",
        borderColor: activity.status === "COMPLETED" ? "#10b981" : "#3b82f6",
        textColor: "#1e3a8a",
        classNames: ["coach-cal-task"],
      };
    default:
      return {
        ...base,
        allDay: true,
        backgroundColor: "#fef3c7",
        borderColor: "#d97706",
        textColor: "#78350f",
      };
  }
}

function EventContent({ arg }: { arg: EventContentArg }) {
  const activity = arg.event.extendedProps.activity as
    | CoachCalendarActivity
    | undefined;
  if (!activity) {
    return <span className="truncate px-1 text-xs">{arg.event.title}</span>;
  }
  const isMonth = arg.view.type === "dayGridMonth";
  const prefix =
    activity.type === "tournament"
      ? "🏆 "
      : activity.type === "coach-assignment"
        ? activity.status === "COMPLETED"
          ? "✅ "
          : "📋 "
        : activity.type === "team-event"
          ? "📣 "
          : "";
  const isPast = arg.isPast;
  const subtitle = [
    !arg.event.allDay && !isMonth ? arg.timeText : null,
    !isMonth ? activity.teamName : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden px-1 py-0.5 text-[0.72rem] leading-tight">
      <span className="truncate font-semibold">
        {isMonth && !arg.event.allDay ? (
          <span className="mr-1 font-normal tabular-nums opacity-80">
            {arg.timeText}
          </span>
        ) : null}
        {prefix}
        {activity.title}
        {activity.playerName && activity.type !== "team-practice"
          ? ` – ${activity.playerName}`
          : ""}
      </span>
      {subtitle ? (
        <span className="truncate opacity-80">{subtitle}</span>
      ) : null}
      {activity.attendance && activity.attendance.members > 0 && !isPast ? (
        <AttendanceCounts
          attendance={activity.attendance}
          compact
          className={cn(
            "mt-0.5 w-fit rounded bg-white/85 px-1 text-[0.68rem]",
            isMonth && "hidden xl:inline-flex",
          )}
        />
      ) : null}
    </div>
  );
}

function TeamChip({
  label,
  icon,
  color,
  active,
  onClick,
}: {
  label: string;
  icon?: string | null;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      )}
    >
      {icon ? (
        <TeamIcon icon={icon} size={16} />
      ) : color ? (
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {label}
    </button>
  );
}

/**
 * Coach calendar: trainings and events of the coach's teams with the
 * players' answers, the coach's sessions and the players' tournaments.
 */
export default function CoachCalendarView() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [view, setView] = useState<CalendarView>("week");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: Date; to: Date } | null>(null);
  const [data, setData] = useState<CoachCalendarPayload | null>(null);
  const [teams, setTeams] = useState<CoachCalendarTeam[]>([]);
  const [upcoming, setUpcoming] = useState<CoachCalendarActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<CoachCalendarActivity | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // "Now" for filtering past items; refreshed whenever data arrives.
  const [now, setNow] = useState(() => Date.now());

  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [overlayPlayerId, setOverlayPlayerId] = useState<string | null>(null);
  const [overlayActivities, setOverlayActivities] = useState<
    CalendarActivity[]
  >([]);

  // Restore the last view and team filter (after hydration, so server and
  // client render the same first frame).
  useEffect(() => {
    const storedView = loadCalendarViewPreference();
    const storedTeam = readStored(TEAM_FILTER_KEY);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (storedView) setView(storedView);
    if (storedView === "agenda") setRange(agendaRange());
    if (storedTeam) setTeamId(storedTeam);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const requestKey = range
    ? `${range.from.toISOString()}|${range.to.toISOString()}|${teamId ?? ""}|${reloadKey}`
    : null;
  const loading = requestKey !== loadedKey;

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    fetchCoachCalendar(range.from, range.to, teamId)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setTeams(payload.teams);
        setNow(Date.now());
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A team that no longer exists (or was handed over) resets the filter.
        if (teamId) {
          setTeamId(null);
          writeStored(TEAM_FILTER_KEY, null);
          return;
        }
        setError(
          err instanceof Error ? err.message : "Calendar could not be loaded",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [range, teamId, reloadKey, requestKey]);

  // "Waiting for answers": the next two weeks, independent of the view.
  useEffect(() => {
    const from = new Date();
    fetchCoachCalendar(
      from,
      new Date(from.getTime() + UPCOMING_DAYS * DAY_MS),
      teamId,
    )
      .then((payload) =>
        setUpcoming(
          payload.activities.filter((activity) => isTeamSession(activity)),
        ),
      )
      .catch(() => setUpcoming([]));
  }, [teamId, reloadKey]);

  useEffect(() => {
    fetch("/api/players/my", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => setPlayers(Array.isArray(list) ? list : []))
      .catch(() => setPlayers([]));
  }, []);

  useEffect(() => {
    if (!overlayPlayerId) return;
    fetch(`/api/calendar/player/${overlayPlayerId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) =>
        setOverlayActivities(
          Array.isArray(payload?.activities)
            ? (payload.activities as CalendarActivity[]).filter(
                (activity) =>
                  activity.type === "availability-block" ||
                  activity.type === "tournament" ||
                  activity.type === "practice-slot",
              )
            : [],
        ),
      )
      .catch(() => setOverlayActivities([]));
  }, [overlayPlayerId]);

  useEffect(() => {
    if (view === "agenda") return;
    calendarRef.current?.getApi().changeView(FC_VIEW[view]);
  }, [view]);

  const colors = useMemo(() => teamColors(teams), [teams]);

  const events = useMemo<EventInput[]>(() => {
    const own = (data?.activities ?? []).map((activity) =>
      toEventInput(activity, colors),
    );
    const overlay = (overlayPlayerId ? overlayActivities : []).map<EventInput>(
      (activity) =>
        activity.type === "availability-block"
          ? {
              id: `overlay-${activity.id}`,
              start: activity.start,
              end: activity.end,
              allDay: activity.allDay,
              display: "background",
              backgroundColor: "#fecaca",
              title: activity.title,
            }
          : {
              id: `overlay-${activity.id}`,
              title: `◐ ${activity.title}`,
              start: activity.start,
              end: activity.end,
              backgroundColor: "#f1f5f9",
              borderColor: "#94a3b8",
              textColor: "#334155",
              classNames: ["opacity-70"],
            },
    );
    return [...own, ...overlay];
  }, [colors, data, overlayActivities, overlayPlayerId]);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange((current) =>
      current &&
      current.from.getTime() === arg.start.getTime() &&
      current.to.getTime() === arg.end.getTime()
        ? current
        : { from: arg.start, to: arg.end },
    );
  }, []);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const activity = arg.event.extendedProps.activity as
      | CoachCalendarActivity
      | undefined;
    if (activity) setSelected(activity);
  }, []);

  const changeView = (value: string) => {
    const next = value as CalendarView;
    setView(next);
    if (next === "agenda") setRange(agendaRange());
    saveCalendarViewPreference(next);
  };

  const changeTeam = (next: string | null) => {
    setTeamId(next);
    writeStored(TEAM_FILTER_KEY, next);
  };

  const waiting = useMemo(
    () =>
      upcoming
        .filter((activity) => hasOpenAnswers(activity))
        .filter((activity) => new Date(activity.end).getTime() > now)
        .slice(0, 8),
    [now, upcoming],
  );

  const agendaDays = useMemo(() => {
    if (view !== "agenda" || !data) return [];
    const byDay = new Map<string, CoachCalendarActivity[]>();
    for (const activity of data.activities) {
      if (new Date(activity.end).getTime() < now) continue;
      const key = localDayKey(activity.start);
      byDay.set(key, [...(byDay.get(key) ?? []), activity]);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, now, view]);

  const overlayName = overlayPlayerId
    ? playerName(
        players.find((player) => player.id === overlayPlayerId) ?? { id: "" },
      )
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TeamChip
          label="All"
          active={teamId === null}
          onClick={() => changeTeam(null)}
        />
        {teams.map((team) => (
          <TeamChip
            key={team.id}
            label={team.shortName}
            icon={team.icon}
            color={colors.get(team.id)?.solid}
            active={teamId === team.id}
            onClick={() => changeTeam(team.id)}
          />
        ))}
        {teams.length === 0 && data ? (
          <span className="text-sm text-slate-500">
            You have no teams yet – team trainings and events appear here.
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
            <Tabs value={view} onValueChange={changeView}>
              <TabsList>
                {(["agenda", "day", "week", "month"] as const).map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="capitalize data-[state=active]:bg-green-600 data-[state=active]:text-white pointer-coarse:min-h-10 pointer-coarse:px-4"
                  >
                    {value}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center gap-2">
              {overlayPlayerId ? (
                <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-rose-50 pl-3 pr-1 text-sm text-rose-800">
                  Showing {overlayName}
                  <button
                    type="button"
                    aria-label="Hide player"
                    onClick={() => setOverlayPlayerId(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-rose-100 pointer-coarse:h-9 pointer-coarse:w-9"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : players.length > 0 ? (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="hidden sm:inline">Show player</span>
                  <select
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm pointer-coarse:h-11"
                    value=""
                    onChange={(event) =>
                      setOverlayPlayerId(event.target.value || null)
                    }
                    aria-label="Show a player's unavailable times"
                  >
                    <option value="">Select…</option>
                    {[...players]
                      .sort((a, b) =>
                        playerName(a).localeCompare(playerName(b)),
                      )
                      .map((player) => (
                        <option key={player.id} value={player.id}>
                          {playerName(player)}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="m-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </button>
            </div>
          ) : null}

          {view === "agenda" ? (
            <div className="space-y-4 p-3">
              {loading && !data ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading calendar…
                </p>
              ) : agendaDays.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-slate-500">
                  Nothing planned in the next four weeks.
                </p>
              ) : (
                agendaDays.map(([day, items]) => (
                  <div key={day}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {formatDay(items[0].start)}
                    </p>
                    <ul className="space-y-1.5">
                      {items.map((activity) => (
                        <AgendaRow
                          key={activity.id}
                          activity={activity}
                          color={colorFor(activity, colors)}
                          onOpen={() => setSelected(activity)}
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div
              className={cn(
                "coach-calendar p-2 sm:p-3 [&_.fc-button]:!h-9 [&_.fc-button]:!rounded-md [&_.fc-button]:!px-3 [&_.fc-button]:!text-sm [&_.fc-button-primary]:!border-green-700 [&_.fc-button-primary]:!bg-green-600 [&_.fc-button-primary:disabled]:!opacity-60 [&_.fc-event]:cursor-pointer [&_.fc-toolbar-title]:!text-lg",
                loading && "opacity-70",
              )}
            >
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={FC_VIEW[view]}
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "",
                }}
                firstDay={1}
                events={events}
                eventContent={(arg) => <EventContent arg={arg} />}
                eventClick={handleEventClick}
                datesSet={handleDatesSet}
                eventTimeFormat={{
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }}
                slotLabelFormat={{
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }}
                slotMinTime={VISIBLE_DAY_START_TIME}
                slotMaxTime={VISIBLE_DAY_END_TIME}
                scrollTime="08:00:00"
                allDaySlot
                nowIndicator
                height="auto"
                dayMaxEvents={4}
              />
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <header className="mb-2 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[var(--golf-primary)]" />
              <h2 className="text-sm font-semibold text-slate-800">
                Waiting for answers
              </h2>
            </header>
            {waiting.length === 0 ? (
              <p className="text-sm text-slate-500">
                Everyone has answered for the next two weeks.
              </p>
            ) : (
              <ul className="space-y-1">
                {waiting.map((activity) => (
                  <li key={activity.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(activity)}
                      className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 pointer-coarse:py-2.5"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: colorFor(activity, colors).solid,
                          }}
                        />
                        <span className="truncate">{activity.title}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 pl-4 text-xs text-slate-500">
                        <span>
                          {formatDay(activity.start)} ·{" "}
                          {formatTime(activity.start)}
                        </span>
                        {activity.attendance ? (
                          <AttendanceCounts
                            attendance={activity.attendance}
                            compact
                          />
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {teams.length > 0 ? (
            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <header className="mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--golf-primary)]" />
                <h2 className="text-sm font-semibold text-slate-800">Legend</h2>
              </header>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {teams.map((team) => (
                  <li key={team.id} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-sm border"
                      style={{
                        backgroundColor: colors.get(team.id)?.soft,
                        borderColor: colors.get(team.id)?.solid,
                      }}
                    />
                    {team.shortName}
                    <span className="ml-auto text-xs text-slate-400">
                      {team.memberCount} players
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-2 pt-1 text-xs text-slate-500">
                  Light = training · solid = team event
                </li>
                <li className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="h-3 w-3 rounded-sm border border-blue-500 bg-blue-50" />
                  Your sessions
                </li>
                {overlayPlayerId ? (
                  <li className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-3 w-3 rounded-sm bg-rose-200" />
                    {overlayName} unavailable
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <SessionDialog activity={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AgendaRow({
  activity,
  color,
  onOpen,
}: {
  activity: CoachCalendarActivity;
  color: TeamColor;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 pointer-coarse:py-3"
      >
        <span
          className="h-10 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color.solid }}
          aria-hidden
        />
        <span className="w-24 shrink-0 text-sm tabular-nums text-slate-600">
          {activity.allDay || activity.type === "tournament"
            ? "All day"
            : `${formatTime(activity.start)}–${formatTime(activity.end)}`}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-800">
            {activity.type === "tournament"
              ? "🏆 "
              : activity.type === "team-event"
                ? "📣 "
                : ""}
            {activity.title}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {[activity.teamName, activity.playerName, activity.location]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {activity.attendance && activity.attendance.members > 0 ? (
          <AttendanceCounts
            attendance={activity.attendance}
            compact
            className="text-xs"
          />
        ) : null}
      </button>
    </li>
  );
}
