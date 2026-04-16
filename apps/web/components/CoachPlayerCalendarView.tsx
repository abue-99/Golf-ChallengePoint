"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { toast } from "sonner";
import { api } from "@/lib/api";
import AssignTaskDialog, { type AssignTaskPayload } from "./AssignTaskDialog";

type CalendarTask = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  scheduledDate: string;
  coachId: string;
};

type SlotData = {
  id: string;
  title: string;
  recurrence: string;
  recurrenceEndDate: string | null;
  occurrences: { start: string; end: string }[];
  tasks: CalendarTask[];
};

type SelectedSlot = {
  id: string;
  title: string;
  occurrenceStart: string;
  occurrenceEnd: string;
};

type Props = {
  playerId: string;
};

export default function CoachPlayerCalendarView({ playerId }: Props) {
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  const loadCalendar = useCallback(async () => {
    try {
      const data = await api.getPlayerCalendar(playerId);
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      toast.error("Failed to load player calendar");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const events = useMemo<EventInput[]>(() => {
    const result: EventInput[] = [];

    for (const slot of slots) {
      for (const occ of slot.occurrences) {
        result.push({
          id: `slot-${slot.id}-${occ.start}`,
          title: slot.title,
          start: occ.start,
          end: occ.end,
          backgroundColor: "#86efac",
          borderColor: "#22c55e",
          textColor: "#166534",
          extendedProps: {
            type: "slot",
            slotId: slot.id,
            occurrenceStart: occ.start,
            occurrenceEnd: occ.end,
          },
        });
      }

      for (const task of slot.tasks) {
        const start = new Date(task.scheduledDate);
        const end = new Date(start.getTime() + task.durationMinutes * 60_000);
        result.push({
          id: `task-${task.id}`,
          title: `📋 ${task.title}`,
          start: start.toISOString(),
          end: end.toISOString(),
          backgroundColor: "#3b82f6",
          borderColor: "#1d4ed8",
          textColor: "#fff",
          extendedProps: {
            type: "task",
            taskId: task.id,
            description: task.description,
            durationMinutes: task.durationMinutes,
          },
        });
      }
    }

    return result;
  }, [slots]);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const { type, slotId, occurrenceStart, occurrenceEnd } =
        arg.event.extendedProps as any;

      if (type === "slot") {
        const slot = slots.find((s) => s.id === slotId);
        if (!slot) return;
        setSelectedSlot({
          id: slot.id,
          title: slot.title,
          occurrenceStart,
          occurrenceEnd,
        });
        setDialogOpen(true);
        return;
      }

      if (type === "task") {
        const { title, description, durationMinutes } =
          arg.event.extendedProps as any;
        toast.info(
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm">{description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Duration: {durationMinutes} min
            </p>
          </div>,
          { duration: 6000 }
        );
      }
    },
    [slots]
  );

  const handleAssignTask = useCallback(
    async (slotId: string, data: AssignTaskPayload) => {
      await api.assignTask(slotId, data);
      toast.success("Task assigned successfully");
      await loadCalendar();
    },
    [loadCalendar]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading calendar…
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        <span className="font-medium">Coach view:</span> Click on a practice
        slot (green) to assign a task. Blue events are already assigned tasks.
      </div>

      <div className="rounded-lg border bg-white p-2 shadow-sm [&_.fc-button]:!rounded [&_.fc-button-primary]:!bg-blue-600 [&_.fc-button-primary]:!border-blue-700 [&_.fc-button-primary.fc-button-active]:!bg-blue-800">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          buttonText={{
            today: "Today",
            month: "Month",
            week: "7 Days",
            day: "Day",
            list: "List",
          }}
          events={events}
          editable={false}
          selectable={false}
          eventClick={handleEventClick}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          height="auto"
          nowIndicator
        />
      </div>

      {slots.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground text-center">
          This player has not defined any practice slots yet.
        </p>
      )}

      <AssignTaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedSlot(null);
        }}
        onSubmit={handleAssignTask}
        slot={selectedSlot}
      />
    </>
  );
}
