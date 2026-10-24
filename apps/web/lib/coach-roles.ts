export type CoachRole = "HEAD_COACH" | "ASSISTANT" | "FITNESS" | "MENTAL";

export const COACH_ROLE_LABEL: Record<CoachRole, string> = {
  HEAD_COACH: "Head coach",
  ASSISTANT: "Assistant coach",
  FITNESS: "Fitness coach",
  MENTAL: "Mental coach",
};

/** Short label for chips on tiles. */
export const COACH_ROLE_SHORT: Record<CoachRole, string> = {
  HEAD_COACH: "Head",
  ASSISTANT: "Assistant",
  FITNESS: "Fitness",
  MENTAL: "Mental",
};

/** Roles a further coach of a team can have. */
export const STAFF_ROLES: CoachRole[] = ["ASSISTANT", "FITNESS", "MENTAL"];

export function roleLabel(role?: string | null) {
  return role && role in COACH_ROLE_LABEL
    ? COACH_ROLE_LABEL[role as CoachRole]
    : "Coach";
}

export type StaffMember = {
  coachId: string;
  firstName: string | null;
  lastName: string | null;
  email?: string;
  profileImage?: string | null;
  role: CoachRole;
  isHead?: boolean;
  isMe?: boolean;
};

export function coachName(member: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  return (
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.email ||
    "Coach"
  );
}
