"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  type: AvailabilityBlockFormData["type"];
  date: string;
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
  return new Date(iso).toISOString().slice(0, 10);
}

function toUTCTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
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
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      title: "",
      type: "CUSTOM",
      date: selectedDate ?? new Date().toISOString().slice(0, 10),
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
        type: defaultValues.type,
        date: toLocalDate(defaultValues.startTime),
        startTime: toUTCTime(defaultValues.startTime),
        endTime: toUTCTime(defaultValues.endTime),
        recurrence: (defaultValues.recurrence as FormValues["recurrence"]) ?? "NONE",
        recurrenceEndDate: defaultValues.recurrenceEndDate ? toLocalDate(defaultValues.recurrenceEndDate) : "",
        notes: defaultValues.notes ?? "",
      });
      return;
    }

    if (open) {
      reset({
        title: "",
        type: "CUSTOM",
        date: selectedDate ?? new Date().toISOString().slice(0, 10),
        startTime: "09:00",
        endTime: "17:00",
        recurrence: "NONE",
        recurrenceEndDate: "",
        notes: "",
      });
    }
  }, [defaultValues, open, reset, selectedDate]);

  const recurrence = watch("recurrence");

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      title: values.title,
      type: values.type,
      startTime: new Date(`${values.date}T${values.startTime}:00Z`).toISOString(),
      endTime: new Date(`${values.date}T${values.endTime}:00Z`).toISOString(),
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
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit blackout time" : "Add blackout time"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="mt-2 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ab-title">Title</Label>
            <Input id="ab-title" placeholder="School, work, holiday, travel…" {...register("title", { required: true })} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ab-type">Type</Label>
            <select
              id="ab-type"
              {...register("type")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="SCHOOL">School</option>
              <option value="WORK">Work</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="TRAVEL">Travel</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ab-date">Date</Label>
            <Input id="ab-date" type="date" {...register("date", { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ab-start">Start time</Label>
              <Input id="ab-start" type="time" {...register("startTime", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ab-end">End time</Label>
              <Input id="ab-end" type="time" {...register("endTime", { required: true })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ab-recurrence">Recurrence</Label>
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
              <Label htmlFor="ab-recurrence-end">Recurrence end date</Label>
              <Input id="ab-recurrence-end" type="date" {...register("recurrenceEndDate")} />
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
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : mode === "edit" ? "Save changes" : "Add blackout"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
