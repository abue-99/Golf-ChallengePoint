"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = {
  title: string;
  description: string;
  durationMinutes: number;
  scheduledDate: string;
  scheduledTime: string;
  isRecurring: boolean;
  recurrenceCount: number;
  recurrenceWeeks: number;
};

export type AssignTaskPayload = {
  title: string;
  description: string;
  durationMinutes: number;
  scheduledDate: string; // ISO
  recurrenceCount?: number;
  recurrenceWeeks?: number;
};

type SlotInfo = {
  id: string;
  title: string;
  /** ISO start of the selected occurrence */
  occurrenceStart: string;
  /** ISO end of the selected occurrence */
  occurrenceEnd: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (slotId: string, data: AssignTaskPayload) => Promise<void>;
  slot: SlotInfo | null;
};

function toLocalDate(iso: string) {
  return iso.slice(0, 10);
}

function toLocalTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function AssignTaskDialog({ open, onClose, onSubmit, slot }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      title: "",
      description: "",
      durationMinutes: 30,
      scheduledDate: "",
      scheduledTime: "09:00",
      isRecurring: false,
      recurrenceCount: 4,
      recurrenceWeeks: 4,
    },
  });

  useEffect(() => {
    if (open && slot) {
      reset({
        title: "",
        description: "",
        durationMinutes: 30,
        scheduledDate: toLocalDate(slot.occurrenceStart),
        scheduledTime: toLocalTime(slot.occurrenceStart),
        isRecurring: false,
        recurrenceCount: 4,
        recurrenceWeeks: 4,
      });
    }
  }, [open, slot, reset]);

  const isRecurring = watch("isRecurring");

  const onFormSubmit = handleSubmit(async (values) => {
    if (!slot) return;
    const scheduledDate = new Date(
      `${values.scheduledDate}T${values.scheduledTime}:00Z`
    ).toISOString();

    await onSubmit(slot.id, {
      title: values.title,
      description: values.description,
      durationMinutes: Number(values.durationMinutes),
      scheduledDate,
      ...(values.isRecurring
        ? {
            recurrenceCount: Number(values.recurrenceCount),
            recurrenceWeeks: Number(values.recurrenceWeeks),
          }
        : {}),
    });
    onClose();
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Task to Slot</DialogTitle>
          {slot && (
            <p className="text-sm text-muted-foreground mt-1">
              Slot: <span className="font-medium">{slot.title}</span>
            </p>
          )}
        </DialogHeader>

        <form onSubmit={onFormSubmit} className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="at-title">Task title</Label>
            <Input
              id="at-title"
              placeholder="e.g. Chipping accuracy drill"
              {...register("title", { required: true })}
            />
            {errors.title && <p className="text-xs text-destructive">Title is required</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="at-desc">Description</Label>
            <textarea
              id="at-desc"
              rows={3}
              placeholder="Describe the task in detail…"
              {...register("description", { required: true })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            {errors.description && (
              <p className="text-xs text-destructive">Description is required</p>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <Label htmlFor="at-duration">Duration (minutes)</Label>
            <Input
              id="at-duration"
              type="number"
              min={5}
              max={480}
              {...register("durationMinutes", { required: true, min: 5 })}
            />
          </div>

          {/* Scheduled date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="at-date">Date</Label>
              <Input id="at-date" type="date" {...register("scheduledDate", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="at-time">Start time</Label>
              <Input id="at-time" type="time" {...register("scheduledTime", { required: true })} />
            </div>
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center gap-2">
            <input
              id="at-recurring"
              type="checkbox"
              {...register("isRecurring")}
              className="h-4 w-4 accent-primary"
            />
            <Label htmlFor="at-recurring" className="cursor-pointer">
              Recurring task
            </Label>
          </div>

          {isRecurring && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="at-count">Repetitions</Label>
                <Input
                  id="at-count"
                  type="number"
                  min={2}
                  max={52}
                  {...register("recurrenceCount", { min: 2 })}
                />
                <p className="text-xs text-muted-foreground">How many times</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="at-weeks">Spread over (weeks)</Label>
                <Input
                  id="at-weeks"
                  type="number"
                  min={1}
                  max={52}
                  {...register("recurrenceWeeks", { min: 1 })}
                />
                <p className="text-xs text-muted-foreground">Distribution window</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !slot}>
              {isSubmitting ? "Assigning…" : "Assign task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
