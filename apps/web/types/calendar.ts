export type CalendarEventExtendedProps = {
  type: "slot" | "task";
  slotId: string;
  occurrenceStart: string;
  occurrenceEnd: string;
  title: string;
  description: string;
  durationMinutes: number;
};
