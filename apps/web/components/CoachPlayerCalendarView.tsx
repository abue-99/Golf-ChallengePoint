"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssignTaskDialog, { type AssignTaskPayload } from "./AssignTaskDialog";
import { activityToEventInput } from "@/lib/calendar-activity";
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

const VIEW_TO_FULLCALENDAR = {
  today: "timeGridDay",
  week: "timeGridWeek",
  month: "dayGridMonth",
} as const;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function CoachPlayerCalendarView({
  playerId,
}: {
  playerId: string;
}) {
  const [calendarData, setCalendarData] = useState<CalendarPayload>({
    activities: [],
    slots: [],
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [activeView, setActiveView] =
    useState<keyof typeof VIEW_TO_FULLCALENDAR>("month");
  const calendarRef = useRef<FullCalendar>(null);

  const loadCalendar = useCallback(async () => {
    try {
      const data = await api.getPlayerCalendar(playerId);
      setCalendarData({
        activities: Array.isArray(data?.activities) ? data.activities : [],
        slots: Array.isArray(data?.slots) ? data.slots : [],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load player calendar",
      );
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    const apiInstance = calendarRef.current?.getApi();
    if (apiInstance) {
      apiInstance.changeView(VIEW_TO_FULLCALENDAR[activeView]);
    }
  }, [activeView]);

  const events = useMemo<EventInput[]>(() => {
    return calendarData.activities.map((activity) =>
      activityToEventInput(activity),
    );
  }, [calendarData.activities]);

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
        if (!slot) return;
        setSelectedSlot({
          id: slot.id,
          title: slot.title,
          occurrenceStart: activity.start,
          occurrenceEnd: activity.end,
        });
        setDialogOpen(true);
        return;
      }

      toast.info(
        <div>
          <p className="font-medium">{activity.title}</p>
          <p className="text-sm">
            {formatDateTime(activity.start)} → {formatDateTime(activity.end)}
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
              Every view includes blackout times, so assigning over school,
              work, holiday, or travel windows now fails with a conflict
              message.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Player calendar
          </p>
          <p className="text-sm text-slate-500">
            Today, week, and month tabs share one unified feed across practices,
            assignments, missions, events, tournaments, milestones, and blackout
            times.
          </p>
        </div>
        <Tabs
          value={activeView}
          onValueChange={(value) =>
            setActiveView(value as keyof typeof VIEW_TO_FULLCALENDAR)
          }
        >
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-2xl border bg-white p-3 shadow-sm [&_.fc-button]:!rounded [&_.fc-button-primary]:!bg-blue-600 [&_.fc-button-primary]:!border-blue-700 [&_.fc-button-primary.fc-button-active]:!bg-blue-800">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
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
