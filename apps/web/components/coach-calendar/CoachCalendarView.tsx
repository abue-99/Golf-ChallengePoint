"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, {
  type DateClickArg,
  type EventResizeDoneArg,
} from "@fullcalendar/interaction";
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Bell,
  BellRing,
  BookOpen,
  CalendarClock,
  Plus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import TeamEventDialog, { type TeamEventDraft } from "./TeamEventDialog";
import LessonLibrary, {
  lessonMeta,
  type PlannableLesson,
} from "./LessonLibrary";
import PlanLessonDialog, { type PlanDraft } from "./PlanLessonDialog";
import { hitTest, pointerOf, sameTarget, type DropTarget } from "./drop-target";
import {
  ApiError,
  deleteCalendarTask,
  deleteTraining,
  moveCalendarTask,
  moveTraining,
  placeInOccurrence,
  planLessonInTraining,
  remindOpenPlayers,
  setAutoRemind,
  timeAgo,
  updateTeamEvent,
} from "@/lib/coach-calendar";
import {
  DRAG_TOUCH_DELAY_MS,
  dragStartFeedback,
  useDragSensors,
} from "@/lib/dnd";
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
const EVENT_MINUTES = 90;
const REMIND_COOLDOWN_MS = 60 * 60 * 1000;
const AUTO_REMIND_OPTIONS = [
  { value: "", label: "Off" },
  { value: "2", label: "2 h before" },
  { value: "24", label: "1 day before" },
  { value: "48", label: "2 days before" },
  { value: "72", label: "3 days before" },
];

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

/** Entries the coach can move or resize in the calendar. */
export function isMovable(
  activity: CoachCalendarActivity,
  viewerId: string | undefined,
  now: number,
  headTeamIds: Set<string>,
) {
  if (new Date(activity.end).getTime() < now) return false;
  // Head coaches change everything of their team, further coaches only
  // what they planned themselves (the API checks the same).
  const mayChange =
    Boolean(activity.teamId && headTeamIds.has(activity.teamId)) ||
    (Boolean(viewerId) && activity.createdById === viewerId);
  switch (activity.type) {
    case "team-event":
      return mayChange;
    case "team-practice":
      // Recurring windows are edited as a series on the Teams page.
      return activity.recurrence === "NONE" && mayChange;
    case "coach-assignment":
      return Boolean(viewerId) && activity.createdById === viewerId;
    default:
      return false;
  }
}

export function toEventInput(
  activity: CoachCalendarActivity,
  colors: Map<string, TeamColor>,
  movable = false,
): EventInput {
  const color = colorFor(activity, colors);
  const base = {
    id: activity.id,
    title: activity.title,
    start: activity.start,
    end: activity.end,
    allDay: activity.allDay,
    editable: movable,
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
  const [eventDraft, setEventDraft] = useState<TeamEventDraft | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [reminding, setReminding] = useState<string | null>(null);

  // Planning: lesson library, drag & drop and tap-to-place.
  const sensors = useDragSensors();
  const calendarBoxRef = useRef<HTMLDivElement | null>(null);
  const [asideTab, setAsideTab] = useState<"overview" | "plan">("overview");
  const [armedLesson, setArmedLesson] = useState<PlannableLesson | null>(null);
  const [draggingLesson, setDraggingLesson] = useState<PlannableLesson | null>(
    null,
  );
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [planKey, setPlanKey] = useState(0);
  // The real pointer position while dragging. dnd-kit's delta also contains
  // the auto-scroll offset, which would put the drop point off by that much.
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!draggingLesson) return;
    const track = (event: PointerEvent | MouseEvent | TouchEvent) => {
      const point =
        "touches" in event
          ? (event.touches[0] ?? event.changedTouches[0])
          : event;
      if (point) lastPointer.current = { x: point.clientX, y: point.clientY };
    };
    const options = { capture: true, passive: true } as const;
    window.addEventListener("pointermove", track, options);
    window.addEventListener("mousemove", track, options);
    window.addEventListener("touchmove", track, options);
    return () => {
      window.removeEventListener("pointermove", track, options);
      window.removeEventListener("mousemove", track, options);
      window.removeEventListener("touchmove", track, options);
    };
  }, [draggingLesson]);

  // Restore the last view and team filter (after hydration, so server and
  // client render the same first frame).
  useEffect(() => {
    const storedView = loadCalendarViewPreference();
    const storedTeam = readStored(TEAM_FILTER_KEY);
    if (storedView) setView(storedView);
    if (storedView === "agenda") setRange(agendaRange());
    if (storedTeam) setTeamId(storedTeam);
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
  const headTeamIds = useMemo(
    () =>
      new Set(teams.filter((team) => team.isHeadCoach).map((team) => team.id)),
    [teams],
  );

  const events = useMemo<EventInput[]>(() => {
    const own = (data?.activities ?? []).map((activity) =>
      toEventInput(
        activity,
        colors,
        isMovable(activity, data?.viewerId, now, headTeamIds),
      ),
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
  }, [colors, data, headTeamIds, now, overlayActivities, overlayPlayerId]);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange((current) =>
      current &&
      current.from.getTime() === arg.start.getTime() &&
      current.to.getTime() === arg.end.getTime()
        ? current
        : { from: arg.start, to: arg.end },
    );
  }, []);

  const reload = () => setReloadKey((key) => key + 1);

  const openPlanDialog = (lesson: PlannableLesson, start: Date) => {
    if (teams.length === 0) {
      toast.info("Create a team first – lessons are planned for a team.");
      return;
    }
    setPlanKey((key) => key + 1);
    setPlanDraft({ lesson, start });
  };

  /** Puts a lesson into one occurrence of a team training. */
  const planIntoTraining = async (
    lesson: PlannableLesson,
    activity: CoachCalendarActivity,
    wanted: Date | null,
  ) => {
    if (new Date(activity.end).getTime() < Date.now()) {
      toast.info("This training is already over.");
      return;
    }
    const place = placeInOccurrence(
      { start: new Date(activity.start), end: new Date(activity.end) },
      wanted,
      lesson.durationMinutes,
    );
    try {
      const tasks = await planLessonInTraining({
        slotId: activity.sourceId,
        lesson,
        start: place.start,
        durationMinutes: place.durationMinutes,
      });
      reload();
      toast.success(
        `${lesson.name} planned in ${activity.title}${activity.teamName ? ` (${activity.teamName})` : ""} at ${formatTime(place.start.toISOString())}${place.shortened ? ` – shortened to ${place.durationMinutes} min` : ""}.`,
        {
          action: {
            label: "Undo",
            onClick: () => {
              void Promise.all(tasks.map((task) => deleteCalendarTask(task.id)))
                .then(() => {
                  toast.success("Undone.");
                  reload();
                })
                .catch((err: unknown) =>
                  toast.error(
                    err instanceof Error ? err.message : "Undo failed",
                  ),
                );
            },
          },
        },
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not plan the lesson.",
      );
    }
  };

  const dropLesson = (lesson: PlannableLesson, target: DropTarget | null) => {
    if (!target) return;
    if (target.kind === "event") {
      const activity = data?.activities.find(
        (item) => item.id === target.activityId,
      );
      if (activity?.type === "team-practice") {
        void planIntoTraining(lesson, activity, target.time);
      } else if (target.time) {
        openPlanDialog(lesson, target.time);
      } else {
        toast.info("Drop the lesson onto a team training or a free time.");
      }
      return;
    }
    if (target.kind === "time") {
      openPlanDialog(lesson, target.start);
      return;
    }
    openPlanDialog(lesson, new Date(`${target.date}T17:00:00`));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const lesson = event.active.data.current?.lesson as
      | PlannableLesson
      | undefined;
    if (!lesson) return;
    setDraggingLesson(lesson);
    setArmedLesson(null);
    lastPointer.current = pointerOf({
      activatorEvent: event.activatorEvent,
      delta: { x: 0, y: 0 },
    });
    dragStartFeedback();
  };

  /** Keyboard drags have no pointer: follow the dragged item instead. */
  const dragPoint = (event: DragMoveEvent | DragEndEvent) =>
    typeof KeyboardEvent !== "undefined" &&
    event.activatorEvent instanceof KeyboardEvent
      ? pointerOf(event)
      : (lastPointer.current ?? pointerOf(event));

  const handleDragMove = (event: DragMoveEvent) => {
    if (!draggingLesson) return;
    const point = dragPoint(event);
    const next = point
      ? hitTest(
          calendarBoxRef.current,
          point.x,
          point.y,
          draggingLesson.durationMinutes || 60,
        )
      : null;
    setDropTarget((current) => (sameTarget(current, next) ? current : next));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const lesson = draggingLesson;
    const point = dragPoint(event);
    lastPointer.current = null;
    const target =
      lesson && point
        ? hitTest(
            calendarBoxRef.current,
            point.x,
            point.y,
            lesson.durationMinutes || 60,
          )
        : null;
    setDraggingLesson(null);
    setDropTarget(null);
    if (lesson && target) dropLesson(lesson, target);
  };

  /** Moving or resizing an entry directly in the calendar. */
  const handleEventChange = async (arg: EventDropArg | EventResizeDoneArg) => {
    const activity = arg.event.extendedProps.activity as
      | CoachCalendarActivity
      | undefined;
    const start = arg.event.start;
    const end = arg.event.end;
    const oldStart = arg.oldEvent.start;
    const oldEnd = arg.oldEvent.end;
    if (!activity || !start || !end || !oldStart || !oldEnd) {
      arg.revert();
      return;
    }
    const when = `${formatDay(start.toISOString())} ${formatTime(start.toISOString())}`;
    const undoToast = (undo: () => Promise<unknown>) => ({
      action: {
        label: "Undo",
        onClick: () => {
          void undo()
            .then(() => {
              toast.success("Undone.");
              reload();
            })
            .catch((err: unknown) =>
              toast.error(err instanceof Error ? err.message : "Undo failed"),
            );
        },
      },
    });

    const save = async (force: boolean): Promise<void> => {
      try {
        if (activity.type === "team-event") {
          const saved = await updateTeamEvent(activity.sourceId, {
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            force,
          });
          toast.success(
            `${activity.title} moved to ${when}.${saved.answersReset ? " The players are asked again." : ""}`,
            undoToast(() =>
              updateTeamEvent(activity.sourceId, {
                startTime: oldStart.toISOString(),
                endTime: oldEnd.toISOString(),
                force: true,
              }),
            ),
          );
        } else if (activity.type === "team-practice") {
          const saved = await moveTraining(
            activity.sourceId,
            start,
            end,
            force,
          );
          toast.success(
            `${activity.title} moved to ${when}.${saved.answersReset ? " The players are asked again." : ""}`,
            undoToast(() =>
              moveTraining(activity.sourceId, oldStart, oldEnd, true),
            ),
          );
        } else if (activity.type === "coach-assignment") {
          const minutes = Math.round(
            (end.getTime() - start.getTime()) / 60_000,
          );
          const oldMinutes = Math.round(
            (oldEnd.getTime() - oldStart.getTime()) / 60_000,
          );
          await moveCalendarTask(activity.sourceId, start, minutes);
          toast.success(
            `${activity.title} moved to ${when}.`,
            undoToast(() =>
              moveCalendarTask(activity.sourceId, oldStart, oldMinutes),
            ),
          );
        } else {
          arg.revert();
          return;
        }
        reload();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && !force) {
          arg.revert();
          toast.warning(err.message, {
            duration: 10_000,
            action: {
              label: "Move anyway",
              onClick: () => void save(true),
            },
          });
          return;
        }
        arg.revert();
        toast.error(
          err instanceof Error ? err.message : "Could not move the entry.",
        );
      }
    };
    await save(false);
  };

  const removeSelected = async (activity: CoachCalendarActivity) => {
    const what =
      activity.type === "coach-assignment"
        ? `Remove “${activity.title}” from the calendar?`
        : `Delete the training “${activity.title}”? The players' answers are deleted too.`;
    if (!window.confirm(what)) return;
    try {
      if (activity.type === "coach-assignment") {
        await deleteCalendarTask(activity.sourceId);
      } else {
        await deleteTraining(activity.sourceId);
      }
      setSelected(null);
      toast.success("Removed.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove it.");
    }
  };

  const handleEventClick = (arg: EventClickArg) => {
    const activity = arg.event.extendedProps.activity as
      | CoachCalendarActivity
      | undefined;
    if (!activity) return;
    if (armedLesson) {
      const lesson = armedLesson;
      setArmedLesson(null);
      if (activity.type === "team-practice") {
        void planIntoTraining(lesson, activity, null);
      } else {
        openPlanDialog(lesson, new Date(activity.start));
      }
      return;
    }
    setSelected(activity);
  };

  const openEventDialog = (draft: TeamEventDraft) => {
    setDraftKey((key) => key + 1);
    setEventDraft(draft);
  };

  const openNewEvent = (start?: Date) => {
    if (teams.length === 0) {
      toast.info("Create a team first – events belong to a team.");
      return;
    }
    const begin = start ? new Date(start) : new Date();
    if (!start) {
      begin.setHours(18, 0, 0, 0);
      if (begin.getTime() < Date.now()) begin.setDate(begin.getDate() + 1);
    }
    openEventDialog({
      teamId: teamId ?? teams[0].id,
      title: "",
      description: "",
      location: "",
      start: begin,
      end: new Date(begin.getTime() + EVENT_MINUTES * 60_000),
    });
  };

  const handleDateClick = (arg: DateClickArg) => {
    if (armedLesson) {
      const lesson = armedLesson;
      setArmedLesson(null);
      const start = new Date(arg.date);
      if (arg.allDay) start.setHours(17, 0, 0, 0);
      openPlanDialog(lesson, start);
      return;
    }
    if (arg.allDay) {
      const start = new Date(arg.date);
      start.setHours(18, 0, 0, 0);
      openNewEvent(start);
    } else {
      openNewEvent(arg.date);
    }
  };

  const openEditEvent = (activity: CoachCalendarActivity) => {
    setSelected(null);
    openEventDialog({
      id: activity.sourceId,
      teamId: activity.teamId ?? "",
      title: activity.title,
      description: activity.description ?? "",
      location: activity.location ?? "",
      start: new Date(activity.start),
      end: new Date(activity.end),
    });
  };

  const canRemind = (activity: CoachCalendarActivity) =>
    isTeamSession(activity) &&
    Boolean(activity.occurrenceKey) &&
    (activity.attendance?.open ?? 0) > 0 &&
    new Date(activity.end).getTime() > now;

  /** Own sessions and one-time trainings can be removed here. */
  const canRemove = (activity: CoachCalendarActivity) =>
    (activity.type === "coach-assignment" &&
      Boolean(data?.viewerId) &&
      activity.createdById === data?.viewerId) ||
    (activity.type === "team-practice" &&
      activity.recurrence === "NONE" &&
      isMovable(activity, data?.viewerId, 0, headTeamIds));

  /** Head coach of the team, or the coach who created the event. */
  const canEditEvent = (activity: CoachCalendarActivity) =>
    Boolean(activity.teamId && headTeamIds.has(activity.teamId)) ||
    (Boolean(data?.viewerId) && activity.createdById === data?.viewerId);

  /** The API allows one reminder per session and hour. */
  const justReminded = (activity: CoachCalendarActivity) =>
    Boolean(
      activity.lastReminder &&
      now - new Date(activity.lastReminder.sentAt).getTime() <
        REMIND_COOLDOWN_MS,
    );

  const remind = async (activity: CoachCalendarActivity) => {
    if (!activity.occurrenceKey) return;
    setReminding(activity.occurrenceKey);
    try {
      const result = await remindOpenPlayers(activity.occurrenceKey);
      if (result.sent > 0) {
        toast.success(
          `Reminder sent to ${result.sent} ${result.sent === 1 ? "player" : "players"}.`,
        );
      } else {
        toast.warning("The reminder could not be delivered by e-mail.");
      }
      const lastReminder = result.lastReminder;
      const update = (item: CoachCalendarActivity) =>
        lastReminder && item.occurrenceKey === activity.occurrenceKey
          ? { ...item, lastReminder }
          : item;
      setSelected((current) => (current ? update(current) : current));
      setData((current) =>
        current
          ? { ...current, activities: current.activities.map(update) }
          : current,
      );
      setUpcoming((current) => current.map(update));
      setNow(Date.now());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reminder failed");
    } finally {
      setReminding(null);
    }
  };

  const changeAutoRemind = async (team: CoachCalendarTeam, value: string) => {
    const hours = value ? Number(value) : null;
    try {
      await setAutoRemind(team.id, hours);
      setTeams((current) =>
        current.map((item) =>
          item.id === team.id ? { ...item, autoRemindHours: hours } : item,
        ),
      );
      toast.success(
        hours
          ? `${team.shortName}: players without an answer get a reminder ${AUTO_REMIND_OPTIONS.find((o) => o.value === value)?.label ?? `${hours} h before`}.`
          : `${team.shortName}: automatic reminders are off.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setting not saved");
    }
  };

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

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDraggingLesson(null);
          setDropTarget(null);
        }}
        autoScroll={{ threshold: { x: 0, y: 0.15 } }}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
              <Tabs value={view} onValueChange={changeView}>
                <TabsList>
                  {(["agenda", "day", "week", "month"] as const).map(
                    (value) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="capitalize data-[state=active]:bg-green-600 data-[state=active]:text-white pointer-coarse:min-h-10 pointer-coarse:px-4"
                      >
                        {value}
                      </TabsTrigger>
                    ),
                  )}
                </TabsList>
              </Tabs>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => openNewEvent()}
                  disabled={teams.length === 0}
                  className="pointer-coarse:h-11"
                >
                  <Plus className="mr-1 h-4 w-4" /> Team event
                </Button>
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

            {armedLesson ? (
              <div className="flex flex-wrap items-center gap-2 border-b bg-green-50 px-3 py-2 text-sm text-green-900">
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  {view === "agenda" || view === "month"
                    ? "Switch to Day or Week, then tap"
                    : "Tap"}{" "}
                  a team training or a free time to plan{" "}
                  <span className="font-semibold">{armedLesson.name}</span>.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setArmedLesson(null)}
                >
                  Cancel
                </Button>
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
                ref={calendarBoxRef}
                data-dragging={draggingLesson ? "true" : undefined}
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
                  dateClick={handleDateClick}
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
                  slotEventOverlap={false}
                  snapDuration="00:15:00"
                  eventLongPressDelay={DRAG_TOUCH_DELAY_MS}
                  eventDragMinDistance={6}
                  eventDrop={(arg) => void handleEventChange(arg)}
                  eventResize={(arg) => void handleEventChange(arg)}
                  eventDidMount={(arg) => {
                    arg.el.dataset.activityId = arg.event.id;
                  }}
                  eventClassNames={(arg) =>
                    dropTarget?.kind === "event" &&
                    dropTarget.activityId === arg.event.id
                      ? ["coach-cal-drop-target"]
                      : []
                  }
                />
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div
              role="tablist"
              aria-label="Side panel"
              className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium"
            >
              {(
                [
                  ["overview", "Overview"],
                  ["plan", "Plan lessons"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={asideTab === value}
                  onClick={() => setAsideTab(value)}
                  className={cn(
                    "min-h-9 rounded-lg px-2 pointer-coarse:min-h-11",
                    asideTab === value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-800",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {asideTab === "plan" ? (
              <section className="rounded-2xl border bg-white p-4 shadow-sm">
                <header className="mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[var(--golf-primary)]" />
                  <h2 className="text-sm font-semibold text-slate-800">
                    Lesson library
                  </h2>
                </header>
                <LessonLibrary
                  armed={armedLesson}
                  onArm={(lesson) => {
                    setArmedLesson(lesson);
                    if (lesson && view !== "day" && view !== "week") {
                      changeView("week");
                    }
                  }}
                />
              </section>
            ) : (
              <>
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
                        <li
                          key={activity.id}
                          className="flex items-center gap-1"
                        >
                          <button
                            type="button"
                            onClick={() => setSelected(activity)}
                            className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 pointer-coarse:py-2.5"
                          >
                            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: colorFor(activity, colors)
                                    .solid,
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
                          <button
                            type="button"
                            onClick={() => void remind(activity)}
                            disabled={
                              reminding === activity.occurrenceKey ||
                              justReminded(activity)
                            }
                            aria-label={`Remind players without an answer for ${activity.title}`}
                            title={
                              activity.lastReminder
                                ? `Last reminder ${timeAgo(activity.lastReminder.sentAt, now)}`
                                : "Remind players without an answer"
                            }
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:w-11"
                          >
                            {activity.lastReminder ? (
                              <BellRing className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Bell className="h-4 w-4" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {teams.length > 0 ? (
                  <section className="rounded-2xl border bg-white p-4 shadow-sm">
                    <header className="mb-1 flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-[var(--golf-primary)]" />
                      <h2 className="text-sm font-semibold text-slate-800">
                        Automatic reminders
                      </h2>
                    </header>
                    <p className="mb-2 text-xs text-slate-500">
                      E-mail to players who have not answered yet.
                    </p>
                    <ul className="space-y-2">
                      {teams.map((team) => (
                        <li
                          key={team.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate text-slate-700">
                            {team.shortName}
                          </span>
                          <select
                            aria-label={`Automatic reminder for ${team.shortName}`}
                            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm disabled:opacity-60 pointer-coarse:h-11"
                            value={
                              team.autoRemindHours
                                ? String(team.autoRemindHours)
                                : ""
                            }
                            disabled={!team.isHeadCoach}
                            title={
                              team.isHeadCoach
                                ? undefined
                                : "Only the head coach can change this"
                            }
                            onChange={(event) =>
                              void changeAutoRemind(team, event.target.value)
                            }
                          >
                            {AUTO_REMIND_OPTIONS.some(
                              (option) =>
                                option.value ===
                                String(team.autoRemindHours ?? ""),
                            ) ? null : (
                              <option value={String(team.autoRemindHours)}>
                                {team.autoRemindHours} h before
                              </option>
                            )}
                            {AUTO_REMIND_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {teams.length > 0 ? (
                  <section className="rounded-2xl border bg-white p-4 shadow-sm">
                    <header className="mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4 text-[var(--golf-primary)]" />
                      <h2 className="text-sm font-semibold text-slate-800">
                        Legend
                      </h2>
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
              </>
            )}
          </aside>
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingLesson ? (
            <div className="w-64 rounded-xl border border-[var(--golf-primary)] bg-white px-3 py-2 shadow-xl">
              <p className="truncate text-sm font-semibold text-slate-800">
                {draggingLesson.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {lessonMeta(draggingLesson)}
              </p>
              <p className="mt-1 truncate text-xs font-medium text-[var(--golf-primary)]">
                {dropTargetLabel(dropTarget, data?.activities ?? [])}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {draggingLesson ? (
        <style>{`
          .coach-calendar[data-dragging="true"] .coach-cal-practice {
            outline: 2px dashed #10b981;
            outline-offset: 1px;
          }
          .coach-calendar .coach-cal-drop-target {
            outline: 3px solid #047857 !important;
            box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.25);
          }
        `}</style>
      ) : null}
      {draggingLesson && dropTarget?.kind === "time" && dropTarget.ghost ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-md border-2 border-dashed border-emerald-600 bg-emerald-100/70 px-1 text-[0.7rem] font-semibold text-emerald-900"
          style={{
            left: dropTarget.ghost.left,
            top: dropTarget.ghost.top,
            width: dropTarget.ghost.width,
            height: dropTarget.ghost.height,
          }}
        >
          {formatTime(dropTarget.start.toISOString())} · new training
        </div>
      ) : null}

      <PlanLessonDialog
        key={`plan-${planKey}`}
        draft={planDraft}
        teams={teams}
        defaultTeamId={teamId}
        onClose={() => setPlanDraft(null)}
        onPlanned={(result) => {
          const lessonName = planDraft?.lesson.name ?? "Lesson";
          setPlanDraft(null);
          reload();
          toast.success(
            `${lessonName} planned for ${formatDay(result.start.toISOString())} ${formatTime(result.start.toISOString())}. The players can answer now.`,
            {
              action: {
                label: "Undo",
                onClick: () => {
                  void deleteTraining(result.slotId)
                    .then(() => {
                      toast.success("Undone.");
                      reload();
                    })
                    .catch((err: unknown) =>
                      toast.error(
                        err instanceof Error ? err.message : "Undo failed",
                      ),
                    );
                },
              },
            },
          );
        }}
      />

      <SessionDialog
        activity={selected}
        onClose={() => setSelected(null)}
        footnote={
          selected?.lastReminder ? (
            <p className="text-xs text-slate-500">
              Last reminder {timeAgo(selected.lastReminder.sentAt, now)}
              {selected.lastReminder.kind === "AUTO" ? " (automatic)" : ""}.
            </p>
          ) : null
        }
        actions={
          selected &&
          ((selected.type === "team-event" && canEditEvent(selected)) ||
            canRemind(selected) ||
            canRemove(selected)) ? (
            <>
              {canRemove(selected) ? (
                <Button
                  variant="ghost"
                  className="mr-auto text-rose-700"
                  onClick={() => void removeSelected(selected)}
                >
                  {selected.type === "coach-assignment"
                    ? "Remove session"
                    : "Delete training"}
                </Button>
              ) : null}
              {selected.type === "team-event" && canEditEvent(selected) ? (
                <Button
                  variant="outline"
                  onClick={() => openEditEvent(selected)}
                >
                  Edit event
                </Button>
              ) : null}
              {canRemind(selected) ? (
                <Button
                  onClick={() => void remind(selected)}
                  disabled={
                    reminding === selected.occurrenceKey ||
                    justReminded(selected)
                  }
                >
                  <Bell className="mr-1 h-4 w-4" />
                  {justReminded(selected)
                    ? "Reminded"
                    : `Remind ${selected.attendance?.open} ${selected.attendance?.open === 1 ? "player" : "players"}`}
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      <TeamEventDialog
        key={draftKey}
        draft={eventDraft}
        teams={teams}
        onClose={() => setEventDraft(null)}
        onSaved={(_event, action) => {
          setEventDraft(null);
          toast.success(
            action === "created"
              ? "Team event created – the players can answer now."
              : action === "updated"
                ? "Team event saved."
                : "Team event deleted.",
          );
          setReloadKey((key) => key + 1);
        }}
      />
    </div>
  );
}

function dropTargetLabel(
  target: DropTarget | null,
  activities: CoachCalendarActivity[],
) {
  if (!target) return "Drop on a training or a free time";
  if (target.kind === "event") {
    const activity = activities.find((item) => item.id === target.activityId);
    if (activity?.type === "team-practice") {
      return `→ ${activity.title}${activity.teamName ? ` · ${activity.teamName}` : ""}`;
    }
    return target.time
      ? `→ New training ${formatDay(target.time.toISOString())} ${formatTime(target.time.toISOString())}`
      : "Drop on a training or a free time";
  }
  if (target.kind === "time") {
    return `→ New training ${formatDay(target.start.toISOString())} ${formatTime(target.start.toISOString())}`;
  }
  return `→ New training on ${formatDay(`${target.date}T12:00:00`)}`;
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
