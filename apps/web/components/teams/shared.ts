/** Shared types, constants and helpers for the coach Teams page. */
export const TEAM_ICONS = [
  "⛳",
  "🏌️",
  "🏆",
  "⭐",
  "🎯",
  "🔥",
  "💪",
  "🌟",
  "🦅",
  "🐯",
  "🦁",
  "🚀",
  "🎖️",
  "🥇",
  "⚡",
  "🌊",
  "🏅",
  "🎽",
  "🧠",
  "💎",
];

// Colored circle icons stored as "circle:#hex"
export const TEAM_COLOR_CIRCLES: { value: string; label: string }[] = [
  { value: "circle:#ef4444", label: "Red" },
  { value: "circle:#f97316", label: "Orange" },
  { value: "circle:#f59e0b", label: "Amber" },
  { value: "circle:#eab308", label: "Yellow" },
  { value: "circle:#84cc16", label: "Lime" },
  { value: "circle:#22c55e", label: "Green" },
  { value: "circle:#10b981", label: "Emerald" },
  { value: "circle:#14b8a6", label: "Teal" },
  { value: "circle:#06b6d4", label: "Cyan" },
  { value: "circle:#3b82f6", label: "Blue" },
  { value: "circle:#6366f1", label: "Indigo" },
  { value: "circle:#8b5cf6", label: "Violet" },
  { value: "circle:#ec4899", label: "Pink" },
  { value: "circle:#f43f5e", label: "Rose" },
  { value: "circle:#64748b", label: "Slate" },
];

export type ClubOption = { id: string; shortId?: string | null; name: string };

export type Player = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  email?: string;
  phoneNumber?: string | null;
  timezone?: string | null;
  lastLogin?: string | null;
  role?: string;
  userClubs?: { clubId: string; club: { id: string; name: string } | null }[];
  coaches?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImage: string | null;
    email?: string;
  }[];
  pendingLessons?: number;
  learningProgress?: {
    lessons: {
      PENDING: number;
      ACCEPTED: number;
      ACTIVE: number;
      COMPLETED: number;
    };
    journeys: {
      PENDING: number;
      ACCEPTED: number;
      ACTIVE: number;
      COMPLETED: number;
    };
  };
};

export type TeamMember = {
  id: string;
  userId: string;
  user: Player | null;
};

export type Team = {
  id: string;
  icon: string | null;
  shortName: string;
  description: string | null;
  category: string;
  clubId: string | null;
  members: TeamMember[];
  pendingLessons?: number;
};

export type AssignmentTarget =
  | { kind: "player"; playerId: string; playerName: string }
  | { kind: "team"; teamId: string; teamName: string };

export type AssignmentResult = {
  id?: string;
  lesson?: { name?: string | null };
  journeyTemplate?: { name?: string | null };
  assignmentsCreated?: number;
  assignments?: {
    id: string;
    playerId: string | null;
    lesson?: { name?: string | null };
  }[];
};

export type FormState = {
  icon: string;
  shortName: string;
  description: string;
  category: string;
  categoryInput: string;
  clubId: string;
};

export const EMPTY_FORM: FormState = {
  icon: "",
  shortName: "",
  description: "",
  category: "",
  categoryInput: "",
  clubId: "",
};

export function initials(p: Player) {
  return (
    `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?"
  );
}

export function queueCountLabel(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function countLabel(count: number, singular: string, plural = `${singular}s`) {
  const resolvedLabel = count === 1 ? singular : plural;
  return `${queueCountLabel(count)} ${resolvedLabel}`;
}

export function assignmentLessonName(result?: AssignmentResult) {
  return (
    result?.lesson?.name ?? result?.assignments?.[0]?.lesson?.name ?? "Lesson"
  );
}

export function assignmentJourneyName(result?: AssignmentResult) {
  return result?.journeyTemplate?.name ?? "Journey";
}

export function playerDisplayName(player: Player) {
  return (
    `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim() ||
    player.email ||
    "—"
  );
}

