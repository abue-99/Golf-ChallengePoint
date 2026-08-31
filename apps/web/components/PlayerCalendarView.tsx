"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { toast } from "sonner";
import { api } from "@/lib/api";
import PracticeSlotDialog, { type PracticeSlotFormData } from "./PracticeSlotDialog";

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

type EditTarget = {
  slot: SlotData;
  occurrenceStart: string;
  occurrenceEnd: string;
};

type Props = {
  userId: string;
  country: string | null;
};

export default function PlayerCalendarView({ userId, country }: Props) {
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const calendarRef = useRef<FullCalendar>(null);

  const loadCalendar = useCallback(async () => {
    try {
      const data = await api.getPlayerCalendar(userId);
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      toast.error("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  // Build FullCalendar event list from slots + tasks
  const events = useMemo<EventInput[]>(() => {
    const result: EventInput[] = [];

    for (const slot of slots) {
      // Practice slot occurrences — shown as green background blocks
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

      // Coach-assigned tasks within this slot — shown as blue events
      for (const task of slot.tasks) {
        const start = new Date(task.scheduledDate);
        const end = new Date(start.getTime() + task.durationMinutes * 60_000);
        result.push({
          id: `task-${task.id}`,
          title: task.title,
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

  const handleDateClick = useCallback((arg: DateClickArg) => {
    setEditTarget(null);
    setSelectedDate(arg.dateStr.slice(0, 10));
    setDialogOpen(true);
  }, []);

  type CalendarEventExtendedProps = {
    type: "slot" | "task";
    slotId: string;
    occurrenceStart: string;
    occurrenceEnd: string;
    title: string;
    description: string;
    durationMinutes: number;
  };

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const { type, slotId, occurrenceStart, occurrenceEnd } = arg.event.extendedProps as CalendarEventExtendedProps;

      if (type === "slot") {
        const slot = slots.find((s) => s.id === slotId);
        if (!slot) return;
        setEditTarget({ slot, occurrenceStart, occurrenceEnd });
        setSelectedDate(undefined);
        setDialogOpen(true);
        return;
      }

      if (type === "task") {
        const { title, description, durationMinutes } = arg.event.extendedProps as CalendarEventExtendedProps;
        toast.info(
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm">{description}</p>
            <p className="text-xs text-muted-foreground mt-1">Duration: {durationMinutes} min</p>
          </div>,
          { duration: 6000 }
        );
      }
    },
    [slots]
  );

  const handleSlotSubmit = useCallback(
    async (data: PracticeSlotFormData) => {
      if (editTarget) {
        await api.updatePracticeSlot(editTarget.slot.id, data);
        toast.success("Practice slot updated");
      } else {
        await api.createPracticeSlot(data);
        toast.success("Practice slot created");
      }
      await loadCalendar();
    },
    [editTarget, loadCalendar]
  );

  const handleSlotDelete = useCallback(async () => {
    if (!editTarget) return;
    await api.deletePracticeSlot(editTarget.slot.id);
    toast.success("Practice slot deleted");
    await loadCalendar();
  }, [editTarget, loadCalendar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading calendar…
      </div>
    );
  }

  return (
    <>
      {country && (
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          Regional context: <span className="font-medium text-foreground">{country}</span>
          <span className="text-xs">(regional events will be available in a future update)</span>
        </div>
      )}

      <div className="rounded-lg border bg-white p-2 shadow-sm [&_.fc-button]:!rounded [&_.fc-button-primary]:!bg-green-600 [&_.fc-button-primary]:!border-green-700 [&_.fc-button-primary.fc-button-active]:!bg-green-800">
        <FullCalendar
          ref={calendarRef}
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
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          height="auto"
          nowIndicator
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Click on any date to create a practice slot · Click on a slot to edit or delete it
      </p>

      <PracticeSlotDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditTarget(null); }}
        onSubmit={handleSlotSubmit}
        onDelete={editTarget ? handleSlotDelete : undefined}
        defaultValues={
          editTarget
            ? {
                title: editTarget.slot.title,
                startTime: editTarget.slot.occurrences[0]?.start ?? editTarget.occurrenceStart,
                endTime: editTarget.slot.occurrences[0]?.end ?? editTarget.occurrenceEnd,
                recurrence: editTarget.slot.recurrence,
                recurrenceEndDate: editTarget.slot.recurrenceEndDate,
              }
            : undefined
        }
        mode={editTarget ? "edit" : "create"}
        selectedDate={selectedDate}
      />
    </>
  );
}
