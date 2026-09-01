"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fromTimeZoneDateTimeToIso,
  fromTimeZoneDateToIso,
  toTimeZoneDateInputValue,
  toTimeZoneTimeInputValue,
} from "@/lib/timezone";

const schema = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]),
  recurrenceEndDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export type PracticeSlotFormData = {
  title: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurrenceEndDate?: string; // ISO
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PracticeSlotFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  /** Pre-filled values for edit mode */
  defaultValues?: {
    title: string;
    startTime: string;
    endTime: string;
    recurrence: string;
    recurrenceEndDate?: string | null;
  };
  mode?: "create" | "edit";
  /** Pre-selected date (YYYY-MM-DD) when creating from a calendar click */
  selectedDate?: string;
  timeZone?: string | null;
};

export default function PracticeSlotDialog({
  open,
  onClose,
  onSubmit,
  onDelete,
  defaultValues,
  mode = "create",
  selectedDate,
  timeZone,
}: Props) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      title: "",
      date: selectedDate ?? new Date().toISOString().slice(0, 10),
      startTime: "09:00",
      endTime: "10:00",
      recurrence: "NONE",
      recurrenceEndDate: "",
    },
  });

  // Populate form when editing an existing slot
  useEffect(() => {
    if (open && defaultValues) {
      reset({
        title: defaultValues.title,
        date: toTimeZoneDateInputValue(defaultValues.startTime, timeZone),
        startTime: toTimeZoneTimeInputValue(defaultValues.startTime, timeZone),
        endTime: toTimeZoneTimeInputValue(defaultValues.endTime, timeZone),
        recurrence: (defaultValues.recurrence as FormValues["recurrence"]) ?? "NONE",
        recurrenceEndDate: defaultValues.recurrenceEndDate
          ? toTimeZoneDateInputValue(defaultValues.recurrenceEndDate, timeZone)
          : "",
      });
    } else if (open && !defaultValues) {
      reset({
        title: "",
        date: selectedDate ?? new Date().toISOString().slice(0, 10),
        startTime: "09:00",
        endTime: "10:00",
        recurrence: "NONE",
        recurrenceEndDate: "",
      });
    }
  }, [open, defaultValues, selectedDate, reset, timeZone]);

  const recurrence = watch("recurrence");

  const onFormSubmit = handleSubmit(async (values) => {
    const startTime = fromTimeZoneDateTimeToIso(
      values.date,
      values.startTime,
      timeZone,
    );
    const endTime = fromTimeZoneDateTimeToIso(
      values.date,
      values.endTime,
      timeZone,
    );
    await onSubmit({
      title: values.title,
      startTime,
      endTime,
      recurrence: values.recurrence,
      recurrenceEndDate:
        values.recurrence !== "NONE" && values.recurrenceEndDate
          ? fromTimeZoneDateToIso(values.recurrenceEndDate, timeZone)
          : undefined,
    });
    onClose();
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Practice Slot" : "New Practice Slot"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onFormSubmit} className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="ps-title">Title</Label>
            <Input
              id="ps-title"
              placeholder="e.g. Morning putting drill"
              {...register("title", { required: true })}
            />
            {errors.title && <p className="text-xs text-destructive">Title is required</p>}
          </div>

          {/* Date */}
          <div className="space-y-1">
            <Label htmlFor="ps-date">Date</Label>
            <Input id="ps-date" type="date" {...register("date", { required: true })} />
            {errors.date && <p className="text-xs text-destructive">Date is required</p>}
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ps-start">Start time</Label>
              <Input id="ps-start" type="time" {...register("startTime", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ps-end">End time</Label>
              <Input id="ps-end" type="time" {...register("endTime", { required: true })} />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-1">
            <Label htmlFor="ps-recurrence">Recurrence</Label>
            <select
              id="ps-recurrence"
              {...register("recurrence")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="NONE">None (one-time)</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          {/* Recurrence end date (only shown when recurring) */}
          {recurrence !== "NONE" && (
            <div className="space-y-1">
              <Label htmlFor="ps-recur-end">Recurrence end date</Label>
              <Input id="ps-recur-end" type="date" {...register("recurrenceEndDate")} />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive/10"
                onClick={async () => { await onDelete(); onClose(); }}
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
                {isSubmitting ? "Saving…" : mode === "edit" ? "Save changes" : "Create slot"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
