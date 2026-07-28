"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrainingWindowFormData = {
  title: string;
  icon: string;
  color: string;
  startTime: string;   // ISO datetime string
  endTime: string;     // ISO datetime string
  recurrence: "NONE" | "WEEKLY" | "MONTHLY";
  recurrenceEndDate?: string;
  focusAreas: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TrainingWindowFormData) => Promise<void>;
  defaultValues?: Partial<TrainingWindowFormData>;
  mode?: "create" | "edit";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ICONS = ["☀️", "🌙", "🏋", "⛳", "🎯", "🧠", "🏌️", "💪", "🔥", "🌿"];

const COLORS = [
  { value: "green", label: "Green", cls: "bg-green-500" },
  { value: "blue", label: "Blue", cls: "bg-blue-500" },
  { value: "amber", label: "Amber", cls: "bg-amber-500" },
  { value: "violet", label: "Violet", cls: "bg-violet-500" },
  { value: "rose", label: "Rose", cls: "bg-rose-500" },
  { value: "cyan", label: "Cyan", cls: "bg-cyan-500" },
];

const FOCUS_AREAS = [
  "Setup",
  "Putting",
  "Short Game",
  "Long Game",
  "Approach",
  "Tactics",
  "Fitness",
  "Mental",
];

const RECURRENCE_OPTIONS = [
  { value: "NONE", label: "One-Time", description: "Single occurrence" },
  { value: "WEEKLY", label: "Weekly", description: "Repeats every week" },
  { value: "MONTHLY", label: "Monthly", description: "Repeats every month" },
] as const;

type RecurrenceValue = (typeof RECURRENCE_OPTIONS)[number]["value"];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 rounded-full transition-all",
            i === current ? "w-6 bg-green-600" : "w-2 bg-gray-200"
          )}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrainingWindowDialog({
  open,
  onClose,
  onSubmit,
  defaultValues,
  mode = "create",
}: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(
    (defaultValues?.recurrence as RecurrenceValue) ?? "NONE"
  );
  const [selectedDate, setSelectedDate] = useState(
    defaultValues?.startTime ? defaultValues.startTime.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [startTimeLocal, setStartTimeLocal] = useState(
    defaultValues?.startTime ? defaultValues.startTime.slice(11, 16) : "09:00"
  );
  const [endTimeLocal, setEndTimeLocal] = useState(
    defaultValues?.endTime ? defaultValues.endTime.slice(11, 16) : "11:00"
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    defaultValues?.recurrenceEndDate?.slice(0, 10) ?? ""
  );
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [icon, setIcon] = useState(defaultValues?.icon ?? "☀️");
  const [color, setColor] = useState(defaultValues?.color ?? "green");
  const [focusAreas, setFocusAreas] = useState<string[]>(defaultValues?.focusAreas ?? []);

  const TOTAL_STEPS = 4;

  function toggleFocus(area: string) {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((f) => f !== area) : [...prev, area]
    );
  }

  function resetForm() {
    setStep(0);
    setRecurrence("NONE");
    setSelectedDate(new Date().toISOString().slice(0, 10));
    setStartTimeLocal("09:00");
    setEndTimeLocal("11:00");
    setRecurrenceEndDate("");
    setTitle("");
    setIcon("☀️");
    setColor("green");
    setFocusAreas([]);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const startTime = new Date(`${selectedDate}T${startTimeLocal}:00`).toISOString();
      const endTime = new Date(`${selectedDate}T${endTimeLocal}:00`).toISOString();
      await onSubmit({
        title: title.trim(),
        icon,
        color,
        startTime,
        endTime,
        recurrence,
        recurrenceEndDate:
          recurrence !== "NONE" && recurrenceEndDate
            ? new Date(`${recurrenceEndDate}T00:00:00`).toISOString()
            : undefined,
        focusAreas,
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  // ── Duration calculation ──
  function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map((v) => parseInt(v, 10));
    return (h || 0) * 60 + (m || 0);
  }
  const startMin = timeToMinutes(startTimeLocal);
  const endMin = timeToMinutes(endTimeLocal);
  const durationMin = endMin > startMin ? endMin - startMin : 0;
  const durationHours = Math.floor(durationMin / 60);
  const durationRemMin = durationMin % 60;
  const durationLabel =
    durationMin <= 0
      ? "—"
      : durationHours > 0 && durationRemMin > 0
      ? `${durationHours}h ${durationRemMin}m`
      : durationHours > 0
      ? `${durationHours}h`
      : `${durationRemMin}m`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl p-0 overflow-hidden">
        <div className="p-5">
          <DialogHeader>
            <DialogTitle>
              <span className="text-center text-base font-semibold text-gray-800 block">
                {mode === "edit" ? "Edit Training Window" : "New Training Window"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <StepDots total={TOTAL_STEPS} current={step} />

          {/* ── Step 0: Type ──────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-center text-sm text-gray-500 mb-4">Select the type of training window</p>
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRecurrence(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all",
                    recurrence === opt.value
                      ? "border-green-500 bg-green-50"
                      : "border-gray-100 bg-white hover:border-gray-300"
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full border-2 flex-shrink-0",
                      recurrence === opt.value
                        ? "border-green-500 bg-green-500"
                        : "border-gray-300"
                    )}
                  />
                  <div>
                    <p className="font-medium text-sm text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 1: Name, Icon, Color, Times ─────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Window name</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Friday Range Practice"
                  className="rounded-xl"
                />
              </div>

              {/* Icon */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((em) => (
                    <button
                      key={em}
                      onClick={() => setIcon(em)}
                      className={cn(
                        "h-9 w-9 rounded-xl text-lg flex items-center justify-center border-2 transition-all",
                        icon === em ? "border-green-500 bg-green-50" : "border-gray-100 bg-white"
                      )}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Color</Label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setColor(c.value)}
                      className={cn(
                        "h-7 w-7 rounded-full transition-all",
                        c.cls,
                        color === c.value ? "ring-2 ring-offset-2 ring-gray-400" : ""
                      )}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">
                  {recurrence === "NONE" ? "Date" : "Starting from"}
                </Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Start time</Label>
                  <Input
                    type="time"
                    value={startTimeLocal}
                    onChange={(e) => setStartTimeLocal(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">End time</Label>
                  <Input
                    type="time"
                    value={endTimeLocal}
                    onChange={(e) => setEndTimeLocal(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Duration pill */}
              {durationMin > 0 && (
                <div className="flex justify-center">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    {durationLabel} capacity
                  </span>
                </div>
              )}

              {/* Recurrence end date */}
              {recurrence !== "NONE" && (
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Repeat until (optional)</Label>
                  <Input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Focus Areas ───────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-center text-sm text-gray-500 mb-1">
                Select preferred training topics
                <span className="block text-xs text-gray-400">(coach can adjust any time)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FOCUS_AREAS.map((area) => {
                  const active = focusAreas.includes(area);
                  return (
                    <button
                      key={area}
                      onClick={() => toggleFocus(area)}
                      className={cn(
                        "rounded-xl border-2 py-3 px-4 text-sm font-medium transition-all",
                        active
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-100 bg-white text-gray-600 hover:border-gray-300"
                      )}
                    >
                      {active ? "✅ " : "⬜ "}{area}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Review + Save ─────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{title || "Unnamed Window"}</p>
                    <p className="text-xs text-gray-500">
                      {recurrence === "NONE"
                        ? `${selectedDate}`
                        : recurrence === "WEEKLY"
                        ? `Every week from ${selectedDate}`
                        : `Every month from ${selectedDate}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>⏰</span>
                  <span>
                    {startTimeLocal} – {endTimeLocal}{" "}
                    <span className="ml-1 text-green-700 font-medium">({durationLabel})</span>
                  </span>
                </div>
                {focusAreas.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Focus areas:</p>
                    <div className="flex flex-wrap gap-1">
                      {focusAreas.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {!title.trim() && (
                <p className="text-center text-xs text-rose-500">Please enter a window name (Step 2)</p>
              )}
            </div>
          )}

          {/* ── Navigation ─────────────────────────────────────── */}
          <div className="mt-6 flex items-center justify-between gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="rounded-xl">
                Back
              </Button>
            ) : (
              <Button variant="outline" onClick={handleClose} className="rounded-xl">
                Cancel
              </Button>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={saving || !title.trim()}
                className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Create Window"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
