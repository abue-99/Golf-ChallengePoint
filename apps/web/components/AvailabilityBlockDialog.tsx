"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AvailabilityCategory =
  | "SCHOOL"
  | "WORK"
  | "HOLIDAY"
  | "TRAVEL"
  | "FAMILY"
  | "OTHER";

export type AvailabilityBlockFormData = {
  title: string;
  type: "SCHOOL" | "WORK" | "HOLIDAY" | "TRAVEL" | "CUSTOM";
  startTime: string;
  endTime: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurrenceEndDate?: string;
  notes?: string;
};

type FormValues = {
  title: string;
  category: AvailabilityCategory;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  recurrence: AvailabilityBlockFormData["recurrence"];
  recurrenceEndDate: string;
  notes: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AvailabilityBlockFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  defaultValues?: {
    title: string;
    type: AvailabilityBlockFormData["type"];
    startTime: string;
    endTime: string;
    recurrence: string;
    recurrenceEndDate?: string | null;
    notes?: string | null;
  };
  mode?: "create" | "edit";
  selectedDate?: string;
};

function toLocalDate(iso: string) {
  const date = new Date(iso);
  const offsetDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );
  return offsetDate.toISOString().slice(0, 10);
}

function toUTCTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function isAllDayBlock(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startsAtMidnight =
    start.getUTCHours() === 0 && start.getUTCMinutes() === 0;
  const endsAtDayEnd =
    end.getUTCHours() === 23 &&
    end.getUTCMinutes() === 59 &&
    end.getUTCSeconds() === 59;
  return startsAtMidnight && endsAtDayEnd;
}

function normalizeCategory(
  category: AvailabilityCategory,
): AvailabilityBlockFormData["type"] {
  if (
    category === "SCHOOL" ||
    category === "WORK" ||
    category === "HOLIDAY" ||
    category === "TRAVEL"
  ) {
    return category;
  }
  return "CUSTOM";
}

export default function AvailabilityBlockDialog({
  open,
  onClose,
  onSubmit,
  onDelete,
  defaultValues,
  mode = "create",
  selectedDate,
}: Props) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      title: "",
      category: "OTHER",
      allDay: false,
      startDate: selectedDate ?? new Date().toISOString().slice(0, 10),
      endDate: selectedDate ?? new Date().toISOString().slice(0, 10),
      startTime: "09:00",
      endTime: "17:00",
      recurrence: "NONE",
      recurrenceEndDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open && defaultValues) {
      reset({
        title: defaultValues.title,
        category:
          defaultValues.type === "CUSTOM"
            ? "OTHER"
            : (defaultValues.type as AvailabilityCategory),
        allDay: isAllDayBlock(defaultValues.startTime, defaultValues.endTime),
        startDate: toLocalDate(defaultValues.startTime),
        endDate: toLocalDate(defaultValues.endTime),
        startTime: toUTCTime(defaultValues.startTime),
        endTime: toUTCTime(defaultValues.endTime),
        recurrence:
          (defaultValues.recurrence as FormValues["recurrence"]) ?? "NONE",
        recurrenceEndDate: defaultValues.recurrenceEndDate
          ? toLocalDate(defaultValues.recurrenceEndDate)
          : "",
        notes: defaultValues.notes ?? "",
      });
      return;
    }

    if (open) {
      reset({
        title: "",
        category: "OTHER",
        allDay: false,
        startDate: selectedDate ?? new Date().toISOString().slice(0, 10),
        endDate: selectedDate ?? new Date().toISOString().slice(0, 10),
        startTime: "09:00",
        endTime: "17:00",
        recurrence: "NONE",
        recurrenceEndDate: "",
        notes: "",
      });
    }
  }, [defaultValues, open, reset, selectedDate]);

  const recurrence = useWatch({ control, name: "recurrence" });
  const allDay = useWatch({ control, name: "allDay" });

  const submit = handleSubmit(async (values) => {
    const startTime = values.allDay
      ? new Date(`${values.startDate}T00:00:00Z`).toISOString()
      : new Date(`${values.startDate}T${values.startTime}:00Z`).toISOString();
    const endTime = values.allDay
      ? new Date(`${values.endDate}T23:59:59Z`).toISOString()
      : new Date(`${values.endDate}T${values.endTime}:00Z`).toISOString();

    await onSubmit({
      title: values.title,
      type: normalizeCategory(values.category),
      startTime,
      endTime,
      recurrence: values.recurrence,
      recurrenceEndDate:
        values.recurrence !== "NONE" && values.recurrenceEndDate
          ? new Date(`${values.recurrenceEndDate}T00:00:00Z`).toISOString()
          : undefined,
      notes: values.notes || undefined,
    });
    onClose();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Unavailability" : "Add Unavailability"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="mt-2 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ab-title">Title</Label>
            <Input
              id="ab-title"
              placeholder="School, work, holiday, travel…"
              {...register("title", { required: true })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ab-category">Category</Label>
            <select
              id="ab-category"
              {...register("category")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="SCHOOL">School</option>
              <option value="WORK">Work</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="TRAVEL">Travel</option>
              <option value="FAMILY">Family</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="ab-all-day"
              type="checkbox"
              {...register("allDay")}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="ab-all-day">All day</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ab-start-date">Start date</Label>
              <Input
                id="ab-start-date"
                type="date"
                {...register("startDate", { required: true })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ab-end-date">End date</Label>
              <Input
                id="ab-end-date"
                type="date"
                {...register("endDate", { required: true })}
              />
            </div>
          </div>

          {!allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ab-start">Start time</Label>
                <Input
                  id="ab-start"
                  type="time"
                  {...register("startTime", { required: true })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ab-end">End time</Label>
                <Input
                  id="ab-end"
                  type="time"
                  {...register("endTime", { required: true })}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="ab-recurrence">Repeat</Label>
            <select
              id="ab-recurrence"
              {...register("recurrence")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="NONE">None</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          {recurrence !== "NONE" && (
            <div className="space-y-1">
              <Label htmlFor="ab-recurrence-end">Repeat until</Label>
              <Input
                id="ab-recurrence-end"
                type="date"
                {...register("recurrenceEndDate")}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="ab-notes">Notes</Label>
            <textarea
              id="ab-notes"
              {...register("notes")}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Optional context for coach scheduling"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  await onDelete();
                  onClose();
                }}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving…"
                  : mode === "edit"
                    ? "Save changes"
                    : "Add Unavailability"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
