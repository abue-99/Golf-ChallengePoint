"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import Link from "next/link";
import { CalendarDays, Flame, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { activityToEventInput } from "@/lib/calendar-activity";
import { api } from "@/lib/api";
import type {
  AvailabilityBlockType,
  CalendarActivity,
  CalendarEventExtendedProps,
} from "@/types/calendar";
import PracticeSlotDialog, {
  type PracticeSlotFormData,
} from "./PracticeSlotDialog";
import AvailabilityBlockDialog, {
  type AvailabilityBlockFormData,
} from "./AvailabilityBlockDialog";

type SlotData = {
  id: string;
  title: string;
  recurrence: string;
  recurrenceEndDate: string | null;
  occurrences: { start: string; end: string }[];
};

type AvailabilityBlock = {
  id: string;
  title: string;
  type: AvailabilityBlockType;
  startTime: string;
  endTime: string;
  recurrence: string;
  recurrenceEndDate: string | null;
  notes?: string | null;
};

type EditTarget = {
  slot: SlotData;
  occurrenceStart: string;
  occurrenceEnd: string;
};

type Props = {
  userId: string;
  country: string | null;
  editable?: boolean;
};

type CalendarPayload = {
  activities: CalendarActivity[];
  slots: SlotData[];
  summary?: { weeklyCompletion?: { completed: number; total: number } };
};

const VIEW_TO_FULLCALENDAR = {
  today: "timeGridDay",
  week: "timeGridWeek",
  month: "dayGridMonth",
} as const;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRange(start: string, end: string) {
  return `${formatDateTime(start)} → ${new Date(end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function splitChecklist(value?: string | null) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function blackoutBadge(type: AvailabilityBlockType) {
  switch (type) {
    case "SCHOOL":
      return "🎒 School";
    case "WORK":
      return "💼 Work";
    case "HOLIDAY":
      return "🌴 Holiday";
    case "TRAVEL":
      return "✈️ Travel";
    default:
      return "⛔ Custom";
  }
}

function ActivityDialog({
  activity,
  open,
  onClose,
  onToggleTask,
}: {
  activity: CalendarActivity | null;
  open: boolean;
  onClose: () => void;
  onToggleTask?: (activity: CalendarActivity) => Promise<void>;
}) {
  if (!activity) return null;

  const checklist = splitChecklist(activity.lesson?.plannedExercises);
  const canToggleTask = activity.type === "coach-assignment" && onToggleTask;
  const isCompleted = activity.status === "COMPLETED";

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{activity.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-slate-600">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 uppercase tracking-wide">
              {activity.type.replace(/-/g, " ")}
            </span>
            {activity.teamName ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                {activity.teamName}
              </span>
            ) : null}
            {activity.priority ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                {activity.priority.replace("PRIORITY_", "P")}
              </span>
            ) : null}
            {activity.availabilityType ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {blackoutBadge(activity.availabilityType)}
              </span>
            ) : null}
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="font-medium text-slate-800">
              {formatRange(activity.start, activity.end)}
            </p>
            {activity.location ? (
              <p className="mt-1 text-xs text-slate-500">{activity.location}</p>
            ) : null}
          </div>

          {activity.type === "lesson-mission" ||
          activity.type === "coach-assignment" ? (
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Mission
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {activity.lesson?.trainingObjective || activity.title}
                </h3>
              </div>

              {checklist.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Exercises
                  </p>
                  <div className="space-y-2">
                    {checklist.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="flex items-start gap-2 rounded-xl bg-white px-3 py-2"
                      >
                        <span className="mt-0.5 text-emerald-600">☐</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activity.lesson?.successCriteria ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Success criteria
                  </p>
                  <div className="rounded-xl bg-white px-3 py-2 text-slate-700">
                    {activity.lesson.successCriteria}
                  </div>
                </div>
              ) : null}

              {activity.type === "lesson-mission" ? (
                <Link
                  href="/player"
                  className="inline-flex rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  Open mission
                </Link>
              ) : null}
            </div>
          ) : null}

          {activity.description ? <p>{activity.description}</p> : null}
          {activity.notes ? <p>{activity.notes}</p> : null}
          {activity.planName ? (
            <p className="text-xs text-slate-500">
              Plan: {activity.planName}
              {activity.blockName ? ` · ${activity.blockName}` : ""}
            </p>
          ) : null}

          {canToggleTask ? (
            <div className="flex justify-end">
              <Button onClick={() => onToggleTask(activity)}>
                {isCompleted ? "Mark as planned" : "Mark session complete"}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PlayerCalendarView({
  userId,
  country,
  editable = true,
}: Props) {
  const [calendarData, setCalendarData] = useState<CalendarPayload>({
    activities: [],
    slots: [],
  });
  const [availabilityBlocks, setAvailabilityBlocks] = useState<
    AvailabilityBlock[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [selectedAvailability, setSelectedAvailability] =
    useState<AvailabilityBlock | null>(null);
  const [selectedActivity, setSelectedActivity] =
    useState<CalendarActivity | null>(null);
  const [activeView, setActiveView] =
    useState<keyof typeof VIEW_TO_FULLCALENDAR>("month");
  const calendarRef = useRef<FullCalendar>(null);

  const loadCalendar = useCallback(async () => {
    try {
      const [calendar, blocks] = await Promise.all([
        api.getPlayerCalendar(userId),
        api.listAvailabilityBlocks(userId),
      ]);
      setCalendarData({
        activities: Array.isArray(calendar?.activities)
          ? calendar.activities
          : [],
        slots: Array.isArray(calendar?.slots) ? calendar.slots : [],
        summary: calendar?.summary,
      });
      setAvailabilityBlocks(Array.isArray(blocks) ? blocks : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load calendar",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

  const weeklyCompletion = calendarData.summary?.weeklyCompletion ?? {
    completed: 0,
    total: 0,
  };

  const handleDateClick = useCallback(
    (arg: DateClickArg) => {
      if (!editable) return;
      setEditTarget(null);
      setSelectedDate(arg.dateStr.slice(0, 10));
      setDialogOpen(true);
    },
    [editable],
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const activity = arg.event.extendedProps as CalendarEventExtendedProps;
      if (activity.type === "practice-slot" && editable) {
        const slot = calendarData.slots.find(
          (item) => item.id === activity.sourceId,
        );
        if (!slot) return;
        setEditTarget({
          slot,
          occurrenceStart: activity.start,
          occurrenceEnd: activity.end,
        });
        setSelectedDate(undefined);
        setDialogOpen(true);
        return;
      }

      if (activity.type === "availability-block" && editable) {
        const block = availabilityBlocks.find(
          (item) => item.id === activity.sourceId,
        );
        if (!block) return;
        setSelectedAvailability(block);
        setAvailabilityOpen(true);
        return;
      }

      setSelectedActivity(activity);
    },
    [availabilityBlocks, calendarData.slots, editable],
  );

  const handleSlotSubmit = useCallback(
    async (data: PracticeSlotFormData) => {
      try {
        if (editTarget) {
          await api.updatePracticeSlot(editTarget.slot.id, data);
          toast.success("Practice slot updated");
        } else {
          await api.createPracticeSlot(data);
          toast.success("Practice slot created");
        }
        await loadCalendar();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to save practice slot",
        );
        throw error;
      }
    },
    [editTarget, loadCalendar],
  );

  const handleSlotDelete = useCallback(async () => {
    if (!editTarget) return;
    try {
      await api.deletePracticeSlot(editTarget.slot.id);
      toast.success("Practice slot deleted");
      await loadCalendar();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete practice slot",
      );
      throw error;
    }
  }, [editTarget, loadCalendar]);

  const handleAvailabilitySubmit = useCallback(
    async (data: AvailabilityBlockFormData) => {
      try {
        if (selectedAvailability) {
          await api.updateAvailabilityBlock(selectedAvailability.id, data);
          toast.success("Blackout time updated");
        } else {
          await api.createAvailabilityBlock(data);
          toast.success("Blackout time added");
        }
        await loadCalendar();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to save blackout time",
        );
        throw error;
      }
    },
    [loadCalendar, selectedAvailability],
  );

  const handleAvailabilityDelete = useCallback(async () => {
    if (!selectedAvailability) return;
    try {
      await api.deleteAvailabilityBlock(selectedAvailability.id);
      toast.success("Blackout time deleted");
      await loadCalendar();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete blackout time",
      );
      throw error;
    }
  }, [loadCalendar, selectedAvailability]);

  const handleTaskToggle = useCallback(
    async (activity: CalendarActivity) => {
      const nextStatus =
        activity.status === "COMPLETED" ? "PLANNED" : "COMPLETED";
      try {
        await api.updateTask(activity.sourceId, { status: nextStatus });
        if (nextStatus === "COMPLETED") {
          await api.recordGamificationActivity(userId).catch(() => null);
        }
        toast.success(
          nextStatus === "COMPLETED" ? "Session completed" : "Session reopened",
        );
        setSelectedActivity(null);
        await loadCalendar();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update session",
        );
      }
    },
    [loadCalendar, userId],
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
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Unified Calendar
              </p>
              <p className="text-sm text-slate-500">
                Today, week, and month views for practice, missions, team
                events, tournaments, milestones, and blackout times.
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

          {country ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Calendar region: <span className="font-semibold">{country}</span>.
              Add player-specific holiday blackout times below when local school
              or travel calendars differ.
            </div>
          ) : null}

          <div className="rounded-2xl border bg-white p-3 shadow-sm [&_.fc-button]:!rounded [&_.fc-button-primary]:!bg-green-600 [&_.fc-button-primary]:!border-green-700 [&_.fc-button-primary.fc-button-active]:!bg-green-800">
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
              dateClick={handleDateClick}
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

          {editable ? (
            <p className="text-xs text-muted-foreground">
              Click any empty date to create a practice slot. Click a blackout
              item to edit player school, work, holiday, or travel conflicts.
            </p>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  This week
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {weeklyCompletion.completed} / {weeklyCompletion.total}
                </p>
                <p className="text-sm text-slate-500">
                  scheduled sessions completed
                </p>
              </div>
              <div className="rounded-full bg-amber-50 p-3 text-amber-600">
                <Flame className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Blackout times
                </p>
                <p className="text-xs text-slate-500">
                  School, work, holiday, and custom no-go windows
                </p>
              </div>
              {editable ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedAvailability(null);
                    setAvailabilityOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              ) : null}
            </div>

            <div className="space-y-3">
              {availabilityBlocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-slate-400">
                  No blackout times yet.
                </div>
              ) : (
                availabilityBlocks.map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    className="w-full rounded-2xl border bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300"
                    onClick={() => {
                      if (!editable) return;
                      setSelectedAvailability(block);
                      setAvailabilityOpen(true);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-800">
                          {block.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {blackoutBadge(block.type)}
                        </p>
                      </div>
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {formatRange(block.startTime, block.endTime)}
                    </p>
                    {block.notes ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {block.notes}
                      </p>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Legend</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <Legend
                color="bg-green-200 border-green-500"
                label="Practice slots"
              />
              <Legend
                color="bg-emerald-100 border-emerald-500"
                label="Team practice"
              />
              <Legend
                color="bg-blue-100 border-blue-600"
                label="Missions and coach assignments"
              />
              <Legend color="bg-cyan-100 border-cyan-600" label="Team events" />
              <Legend
                color="bg-red-100 border-red-600"
                label="Tournaments priority 1"
              />
              <Legend
                color="bg-orange-100 border-orange-600"
                label="Tournaments priority 2"
              />
              <Legend
                color="bg-yellow-100 border-yellow-600"
                label="Tournaments priority 3"
              />
              <Legend
                color="bg-violet-100 border-violet-600"
                label="Milestones"
              />
              <Legend
                color="bg-slate-100 border-slate-500"
                label="Blackout times"
              />
            </div>
          </div>
        </aside>
      </div>

      <PracticeSlotDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditTarget(null);
        }}
        onSubmit={handleSlotSubmit}
        onDelete={editTarget ? handleSlotDelete : undefined}
        defaultValues={
          editTarget
            ? {
                title: editTarget.slot.title,
                startTime:
                  editTarget.slot.occurrences[0]?.start ??
                  editTarget.occurrenceStart,
                endTime:
                  editTarget.slot.occurrences[0]?.end ??
                  editTarget.occurrenceEnd,
                recurrence: editTarget.slot.recurrence,
                recurrenceEndDate: editTarget.slot.recurrenceEndDate,
              }
            : undefined
        }
        mode={editTarget ? "edit" : "create"}
        selectedDate={selectedDate}
      />

      <AvailabilityBlockDialog
        open={availabilityOpen}
        onClose={() => {
          setAvailabilityOpen(false);
          setSelectedAvailability(null);
        }}
        onSubmit={handleAvailabilitySubmit}
        onDelete={selectedAvailability ? handleAvailabilityDelete : undefined}
        defaultValues={
          selectedAvailability
            ? {
                title: selectedAvailability.title,
                type: selectedAvailability.type,
                startTime: selectedAvailability.startTime,
                endTime: selectedAvailability.endTime,
                recurrence: selectedAvailability.recurrence,
                recurrenceEndDate: selectedAvailability.recurrenceEndDate,
                notes: selectedAvailability.notes,
              }
            : undefined
        }
        mode={selectedAvailability ? "edit" : "create"}
        selectedDate={selectedDate}
      />

      <ActivityDialog
        activity={selectedActivity}
        open={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
        onToggleTask={editable ? handleTaskToggle : undefined}
      />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded-sm border ${color}`} />
      <span>{label}</span>
    </div>
  );
}
