import type { EventInput } from "@fullcalendar/core";
import type { CalendarActivity } from "@/types/calendar";

const FOCUS_AREA_COLORS: Record<
  string,
  { solid: string; border: string; text: string; soft: string }
> = {
  SETUP: {
    solid: "#0f766e",
    border: "#115e59",
    text: "#ffffff",
    soft: "#ccfbf1",
  },
  PUTTING: {
    solid: "#2563eb",
    border: "#1d4ed8",
    text: "#ffffff",
    soft: "#dbeafe",
  },
  SHORT_GAME: {
    solid: "#059669",
    border: "#047857",
    text: "#ffffff",
    soft: "#d1fae5",
  },
  LONG_GAME: {
    solid: "#7c3aed",
    border: "#6d28d9",
    text: "#ffffff",
    soft: "#ede9fe",
  },
  TACTICAL: {
    solid: "#ea580c",
    border: "#c2410c",
    text: "#ffffff",
    soft: "#fed7aa",
  },
  FITNESS: {
    solid: "#dc2626",
    border: "#b91c1c",
    text: "#ffffff",
    soft: "#fee2e2",
  },
  MENTAL: {
    solid: "#7e22ce",
    border: "#6b21a8",
    text: "#ffffff",
    soft: "#f3e8ff",
  },
};

function resolveFocusColors(focusArea?: string | null) {
  return (
    FOCUS_AREA_COLORS[focusArea ?? ""] ?? {
      solid: "#3b82f6",
      border: "#1d4ed8",
      text: "#ffffff",
      soft: "#dbeafe",
    }
  );
}

export function getActivityLabel(activity: CalendarActivity) {
  switch (activity.type) {
    case "practice-slot":
      return `🏌️ ${activity.title}`;
    case "team-practice":
      return `👥 ${activity.title}`;
    case "coach-assignment":
      return `${activity.status === "COMPLETED" ? "✅" : "📋"} ${activity.title}`;
    case "lesson-mission":
      return `🎯 ${activity.title}`;
    case "availability-block":
      return `⛔ ${activity.title}`;
    case "team-event":
      return `📣 ${activity.title}`;
    case "tournament":
      return `🏆 ${activity.title}`;
    case "milestone":
      return `🚩 ${activity.title}`;
  }
}

export function activityToEventInput(activity: CalendarActivity): EventInput {
  if (activity.type === "practice-slot") {
    return {
      id: activity.id,
      title: getActivityLabel(activity),
      start: activity.start,
      end: activity.end,
      backgroundColor: "#dcfce7",
      borderColor: "#22c55e",
      textColor: "#166534",
      extendedProps: activity,
    };
  }

  if (activity.type === "team-practice") {
    return {
      id: activity.id,
      title: getActivityLabel(activity),
      start: activity.start,
      end: activity.end,
      backgroundColor: "#d1fae5",
      borderColor: "#10b981",
      textColor: "#065f46",
      extendedProps: activity,
    };
  }

  if (activity.type === "coach-assignment") {
    const colors = resolveFocusColors(activity.lesson?.focusArea);
    return {
      id: activity.id,
      title: getActivityLabel(activity),
      start: activity.start,
      end: activity.end,
      backgroundColor:
        activity.status === "COMPLETED" ? "#dcfce7" : colors.solid,
      borderColor: activity.status === "COMPLETED" ? "#16a34a" : colors.border,
      textColor: activity.status === "COMPLETED" ? "#166534" : colors.text,
      extendedProps: activity,
    };
  }

  if (activity.type === "lesson-mission") {
    const colors = resolveFocusColors(activity.lesson?.focusArea);
    return {
      id: activity.id,
      title: getActivityLabel(activity),
      start: activity.start,
      end: activity.end,
      backgroundColor: colors.soft,
      borderColor: colors.solid,
      textColor: colors.border,
      extendedProps: activity,
    };
  }

  if (activity.type === "availability-block") {
    return {
      id: activity.id,
      title: getActivityLabel(activity),
      start: activity.start,
      end: activity.end,
      backgroundColor: "#f1f5f9",
      borderColor: "#94a3b8",
      textColor: "#334155",
      extendedProps: activity,
    };
  }

  if (activity.type === "team-event") {
    return {
      id: activity.id,
      title: getActivityLabel(activity),
      start: activity.start,
      end: activity.end,
      backgroundColor: "#cffafe",
      borderColor: "#0891b2",
      textColor: "#155e75",
      extendedProps: activity,
    };
  }

  if (activity.type === "tournament") {
    const colors =
      activity.priority === "PRIORITY_1"
        ? {
            backgroundColor: "#fee2e2",
            borderColor: "#dc2626",
            textColor: "#991b1b",
          }
        : activity.priority === "PRIORITY_2"
          ? {
              backgroundColor: "#fed7aa",
              borderColor: "#ea580c",
              textColor: "#9a3412",
            }
          : {
              backgroundColor: "#fef3c7",
              borderColor: "#d97706",
              textColor: "#92400e",
            };
    return {
      id: activity.id,
      title: getActivityLabel(activity),
      start: activity.start,
      end: activity.end,
      ...colors,
      extendedProps: activity,
    };
  }

  return {
    id: activity.id,
    title: getActivityLabel(activity),
    start: activity.start,
    end: activity.end,
    allDay: activity.allDay,
    backgroundColor: "#ede9fe",
    borderColor: "#8b5cf6",
    textColor: "#5b21b6",
    extendedProps: activity,
  };
}
