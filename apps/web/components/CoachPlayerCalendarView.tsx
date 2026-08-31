"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssignTaskDialog, { type AssignTaskPayload } from "./AssignTaskDialog";
import {
  activityToEventInput,
  formatCalendarDateTime,
  VIEW_TO_FULLCALENDAR,
} from "@/lib/calendar-activity";
import { api } from "@/lib/api";
import type {
  CalendarActivity,
  CalendarEventExtendedProps,
} from "@/types/calendar";

type SlotData = {
  id: string;
  title: string;
  recurrence: string;
  recurrenceEndDate: string | null;
  occurrences: { start: string; end: string }[];
};

type SelectedSlot = {
  id: string;
  title: string;
  occurrenceStart: string;
  occurrenceEnd: string;
};

type CalendarPayload = {
  activities: CalendarActivity[];
  slots: SlotData[];
};

const VISIBLE_DAY_START_MINUTES = 6 * 60;
const VISIBLE_DAY_END_MINUTES = 21 * 60;

type VisibleRange = { start: Date; end: Date } | null;

export default function CoachPlayerCalendarView({
  playerId,
  coachId,
}: {
  playerId: string;
  coachId?: string;
}) {
  const [calendarData, setCalendarData] = useState<CalendarPayload>({
    activities: [],
    slots: [],
  });
  const [coachActivities, setCoachActivities] = useState<CalendarActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [compareWithCoach, setCompareWithCoach] = useState(Boolean(coachId));
  const [comparisonNowMs] = useState<number>(() => Date.now());
  const [activeView, setActiveView] =
    useState<keyof typeof VIEW_TO_FULLCALENDAR>(() =>
      typeof window !== "undefined" && window.innerWidth >= 1024
        ? "week"
        : "agenda",
    );
  const [visibleRange, setVisibleRange] = useState<VisibleRange>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const loadCalendar = useCallback(async () => {
    try {
      const [playerCalendar, coachCalendar] = await Promise.all([
        api.getPlayerCalendar(playerId),
        coachId ? api.getPlayerCalendar(coachId) : Promise.resolve(null),
      ]);
      setCalendarData({
        activities: Array.isArray(playerCalendar?.activities)
          ? playerCalendar.activities
          : [],
        slots: Array.isArray(playerCalendar?.slots) ? playerCalendar.slots : [],
      });
      setCoachActivities(
        Array.isArray(coachCalendar?.activities) ? coachCalendar.activities : [],
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load player calendar",
      );
    } finally {
      setLoading(false);
    }
  }, [coachId, playerId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    if (!coachId) setCompareWithCoach(false);
  }, [coachId]);

  useEffect(() => {
    const apiInstance = calendarRef.current?.getApi();
    if (apiInstance) {
      apiInstance.changeView(VIEW_TO_FULLCALENDAR[activeView]);
    }
  }, [activeView]);

  const events = useMemo<EventInput[]>(() => {
    const playerEvents = calendarData.activities.map((activity) =>
      activityToEventInput(activity),
    );
    if (!compareWithCoach) return playerEvents;

    const coachEvents = coachActivities.map((activity) => {
      const base = activityToEventInput(activity);
      return {
        ...base,
        id: `coach-${activity.id}`,
        title: `Coach · ${activity.title}`,
        backgroundColor: "#ede9fe",
        borderColor: "#8b5cf6",
        textColor: "#5b21b6",
      };
    });

    return [...playerEvents, ...coachEvents];
  }, [calendarData.activities, coachActivities, compareWithCoach]);

  const playerNext = useMemo(
    () =>
      [...calendarData.activities]
        .filter((activity) => new Date(activity.end).getTime() >= comparisonNowMs)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0],
    [calendarData.activities, comparisonNowMs],
  );
  const coachNext = useMemo(
    () =>
      [...coachActivities]
        .filter((activity) => new Date(activity.end).getTime() >= comparisonNowMs)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0],
    [coachActivities, comparisonNowMs],
  );
  const isTimeGridView = activeView === "day" || activeView === "week";
  const timelineActivities = useMemo<CalendarActivity[]>(() => {
    if (!compareWithCoach) return calendarData.activities;
    return [
      ...calendarData.activities,
      ...coachActivities.map((activity) => ({
        ...activity,
        id: `coach-${activity.id}`,
        title: `Coach · ${activity.title}`,
      })),
    ];
  }, [calendarData.activities, coachActivities, compareWithCoach]);
  const outOfRangeActivities = useMemo(() => {
    if (!visibleRange || !isTimeGridView) return { before: [], after: [] } as {
      before: CalendarActivity[];
      after: CalendarActivity[];
    };

    const before: CalendarActivity[] = [];
    const after: CalendarActivity[] = [];

    for (const activity of timelineActivities) {
      const start = new Date(activity.start);
      const end = new Date(activity.end);
      if (end <= visibleRange.start || start >= visibleRange.end) continue;

      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();

      if (startMinutes < VISIBLE_DAY_START_MINUTES) before.push(activity);
      if (endMinutes > VISIBLE_DAY_END_MINUTES) after.push(activity);
    }

    return { before, after };
  }, [isTimeGridView, timelineActivities, visibleRange]);

  const showOutOfRangeItems = useCallback(
    (position: "before" | "after") => {
      const items = outOfRangeActivities[position];
      if (items.length === 0) return;

      toast.info(
        <div className="space-y-1">
          <p className="font-semibold">
            {position === "before" ? "Before 06:00" : "After 21:00"}
          </p>
          {items.slice(0, 6).map((item) => (
            <p key={`${position}-${item.id}`} className="text-sm">
              {item.title} · {formatCalendarDateTime(item.start)} →{" "}
              {formatCalendarDateTime(item.end)}
            </p>
          ))}
          {items.length > 6 ? (
            <p className="text-xs text-slate-500">+{items.length - 6} more</p>
          ) : null}
        </div>,
        { duration: 7000 },
      );
    },
    [outOfRangeActivities],
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const activity = arg.event.extendedProps as CalendarEventExtendedProps;

      if (
        activity.type === "practice-slot" ||
        activity.type === "team-practice"
      ) {
        const slot = calendarData.slots.find(
          (item) => item.id === activity.sourceId,
        );
        if (slot) {
          setSelectedSlot({
            id: slot.id,
            title: slot.title,
            occurrenceStart: activity.start,
            occurrenceEnd: activity.end,
          });
          setDialogOpen(true);
          return;
        }
      }

      toast.info(
        <div>
          <p className="font-medium">{activity.title}</p>
          <p className="text-sm">
            {formatCalendarDateTime(activity.start)} →{" "}
            {formatCalendarDateTime(activity.end)}
          </p>
          {activity.description ? (
            <p className="mt-1 text-sm">{activity.description}</p>
          ) : null}
        </div>,
        { duration: 6000 },
      );
    },
    [calendarData.slots],
  );

  const handleAssignTask = useCallback(
    async (slotId: string, data: AssignTaskPayload) => {
      try {
        await api.assignTask(slotId, data);
        toast.success("Task assigned successfully");
        await loadCalendar();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to assign task",
        );
        throw error;
      }
    },
    [loadCalendar],
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading calendar…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Coach scheduling view</p>
            <p>
              Every view includes unavailable periods, so assigning over school,
              work, holiday, or travel windows now fails with a conflict
              message.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Player vs coach calendar
          </p>
          <p className="text-sm text-slate-500">
            Views for sessions, events, and so on. Coach events are highlighted
            in violet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {coachId ? (
            <Button
              size="sm"
              variant={compareWithCoach ? "default" : "outline"}
              onClick={() => setCompareWithCoach((current) => !current)}
            >
              {compareWithCoach ? "Hide coach overlay" : "Show coach overlay"}
            </Button>
          ) : null}
          <Tabs
            value={activeView}
            onValueChange={(value) =>
              setActiveView(value as keyof typeof VIEW_TO_FULLCALENDAR)
            }
          >
            <TabsList>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {compareWithCoach ? (
        <div className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Selected player · Next up
            </p>
            <p className="mt-1 font-semibold text-slate-800">
              {playerNext ? playerNext.title : "No scheduled items"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
              Coach · Next up
            </p>
            <p className="mt-1 font-semibold text-violet-700">
              {coachNext ? coachNext.title : "No scheduled items"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-3 shadow-sm [&_.fc-button]:!rounded [&_.fc-button-primary]:!bg-blue-600 [&_.fc-button-primary]:!border-blue-700 [&_.fc-button-primary.fc-button-active]:!bg-blue-800">
        {isTimeGridView ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {outOfRangeActivities.before.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => showOutOfRangeItems("before")}
              >
                <ArrowUp className="mr-1 h-4 w-4" />
                {outOfRangeActivities.before.length} before 06:00
              </Button>
            ) : null}
            {outOfRangeActivities.after.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => showOutOfRangeItems("after")}
              >
                <ArrowDown className="mr-1 h-4 w-4" />
                {outOfRangeActivities.after.length} after 21:00
              </Button>
            ) : null}
          </div>
        ) : null}
        <FullCalendar
          ref={calendarRef}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
            listPlugin,
          ]}
          initialView={VIEW_TO_FULLCALENDAR[activeView]}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          events={events}
          editable={false}
          selectable={false}
          eventClick={handleEventClick}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          datesSet={(arg: DatesSetArg) =>
            setVisibleRange({ start: arg.start, end: arg.end })
          }
          slotMinTime="06:00:00"
          slotMaxTime="21:00:00"
          allDaySlot
          height="auto"
          nowIndicator
        />
      </div>

      {calendarData.slots.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          This player has not defined any practice slots yet.
        </p>
      ) : null}

      <AssignTaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedSlot(null);
        }}
        onSubmit={handleAssignTask}
        slot={selectedSlot}
      />
    </div>
  );
}
