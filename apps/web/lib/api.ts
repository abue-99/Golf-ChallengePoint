export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleResponse(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? Array.isArray((data as { message: unknown }).message)
          ? (data as { message: string[] }).message.join(", ")
          : String((data as { message: unknown }).message)
        : `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return data;
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  listTemplates: () => req("/task-templates"),
  listEvents: (playerId: string) =>
    req(`/calendar/events?playerId=${playerId}`),
  createEvent: (payload: Record<string, unknown>) =>
    req("/calendar/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEvent: (id: string, payload: Record<string, unknown>) =>
    req(`/calendar/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  createLog: (payload: Record<string, unknown>) =>
    req("/task-logs", { method: "POST", body: JSON.stringify(payload) }),

  // Calendar – practice slots
  listPracticeSlots: (playerId?: string) =>
    fetch(
      `/api/calendar/slots${playerId ? `?playerId=${encodeURIComponent(playerId)}` : ""}`,
      { cache: "no-store" },
    ).then((r) => r.json()),
  createPracticeSlot: (payload: Record<string, unknown>) =>
    fetch("/api/calendar/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  updatePracticeSlot: (id: string, payload: Record<string, unknown>) =>
    fetch(`/api/calendar/slots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  deletePracticeSlot: (id: string) =>
    fetch(`/api/calendar/slots/${id}`, { method: "DELETE" }).then(
      handleResponse,
    ),
  listAvailabilityBlocks: (playerId?: string) =>
    fetch(
      `/api/calendar/availability${playerId ? `?playerId=${encodeURIComponent(playerId)}` : ""}`,
      { cache: "no-store" },
    ).then((r) => r.json()),
  createAvailabilityBlock: (payload: Record<string, unknown>) =>
    fetch("/api/calendar/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  updateAvailabilityBlock: (id: string, payload: Record<string, unknown>) =>
    fetch(`/api/calendar/availability/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  deleteAvailabilityBlock: (id: string) =>
    fetch(`/api/calendar/availability/${id}`, { method: "DELETE" }).then(
      handleResponse,
    ),

  // Calendar – slot tasks
  listSlotTasks: (slotId: string) =>
    fetch(`/api/calendar/slots/${slotId}/tasks`, { cache: "no-store" }).then(
      (r) => r.json(),
    ),
  assignTask: (slotId: string, payload: Record<string, unknown>) =>
    fetch(`/api/calendar/slots/${slotId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  updateTask: (id: string, payload: Record<string, unknown>) =>
    fetch(`/api/calendar/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  deleteTask: (id: string) =>
    fetch(`/api/calendar/tasks/${id}`, { method: "DELETE" }).then(
      handleResponse,
    ),

  // Calendar – full player calendar view
  getPlayerCalendar: (playerId: string) =>
    fetch(`/api/calendar/player/${playerId}`, { cache: "no-store" }).then((r) =>
      r.json(),
    ),

  // Calendar – team training windows
  getTeamTrainingWindows: (teamId: string) =>
    fetch(`/api/calendar/team-slots/${teamId}`, { cache: "no-store" }).then(
      (r) => r.json(),
    ),
  createTeamPracticeSlot: (teamId: string, payload: object) =>
    fetch(`/api/calendar/team-slots/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  updateTeamPracticeSlot: (slotId: string, payload: object) =>
    fetch(`/api/calendar/slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  deleteTeamPracticeSlot: (slotId: string) =>
    fetch(`/api/calendar/slots/${slotId}`, { method: "DELETE" }).then(
      handleResponse,
    ),

  // Lessons
  listLessons: (params?: {
    status?: string;
    focusArea?: string;
    subCapability?: string;
    subSubCapability?: string;
    visibility?: string;
  }) => {
    const qs = params
      ? new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== undefined) as [
            string,
            string,
          ][],
        ).toString()
      : "";
    return fetch(`/api/lessons${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
    }).then((r) => r.json());
  },
  getLesson: (id: string) =>
    fetch(`/api/lessons/${id}`, { cache: "no-store" }).then((r) => r.json()),
  createLesson: (payload: Record<string, unknown>) =>
    fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
  updateLesson: (id: string, payload: Record<string, unknown>) =>
    fetch(`/api/lessons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
  deleteLesson: (id: string) =>
    fetch(`/api/lessons/${id}`, { method: "DELETE" }).then((r) => r.json()),
  listLessonPlayers: () =>
    fetch("/api/lessons/players", { cache: "no-store" }).then((r) => r.json()),

  // File upload (video)
  uploadVideo: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch("/api/upload", { method: "POST", body: form }).then((r) =>
      r.json(),
    );
  },

  // Development Plans
  listPlansForPlayer: (playerId: string) =>
    fetch(`/api/development-plans/player/${playerId}`, {
      cache: "no-store",
    }).then((r) => r.json()),
  listPlansForTeam: (teamId: string) =>
    fetch(`/api/development-plans/team/${teamId}`, { cache: "no-store" }).then(
      (r) => r.json(),
    ),
  getMyPlans: () =>
    fetch("/api/development-plans/my-plans", { cache: "no-store" }).then((r) =>
      r.json(),
    ),
  createPlan: (payload: Record<string, unknown>) =>
    fetch("/api/development-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
  updatePlan: (planId: string, payload: Record<string, unknown>) =>
    fetch(`/api/development-plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
  deletePlan: (planId: string) =>
    fetch(`/api/development-plans/${planId}`, { method: "DELETE" }).then((r) =>
      r.json(),
    ),

  // Training Blocks
  createBlock: (planId: string, payload: Record<string, unknown>) =>
    fetch(`/api/development-plans/${planId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
  updateBlock: (blockId: string, payload: Record<string, unknown>) =>
    fetch(`/api/development-plans/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
  deleteBlock: (blockId: string) =>
    fetch(`/api/development-plans/blocks/${blockId}`, {
      method: "DELETE",
    }).then((r) => r.json()),

  // Lesson Assignments
  addAssignment: (blockId: string, payload: Record<string, unknown>) =>
    fetch(`/api/development-plans/blocks/${blockId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  updateAssignment: (assignmentId: string, payload: Record<string, unknown>) =>
    fetch(`/api/development-plans/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  removeAssignment: (assignmentId: string) =>
    fetch(`/api/development-plans/assignments/${assignmentId}`, {
      method: "DELETE",
    }).then(handleResponse),
  getGamificationProfile: (userId: string) =>
    fetch(`/api/gamification/${userId}`, { cache: "no-store" }).then((r) =>
      r.json(),
    ),
  recordGamificationActivity: (userId: string) =>
    fetch(`/api/gamification/${userId}/activity`, { method: "POST" }).then(
      handleResponse,
    ),

  // Standalone Lesson Assignments (Assignment-First model)
  createStandaloneAssignment: (payload: Record<string, unknown>) =>
    fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  listMyStandaloneAssignments: (params?: { status?: string; queueOnly?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.queueOnly) qs.set("queueOnly", "true");
    const url = qs.toString() ? `/api/assignments?${qs}` : "/api/assignments";
    return fetch(url, { cache: "no-store" }).then(handleResponse);
  },
  updateStandaloneAssignment: (id: string, payload: Record<string, unknown>) =>
    fetch(`/api/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  moveStandaloneAssignmentToQueue: (id: string) =>
    fetch(`/api/assignments/${id}/queue`, { method: "POST" }).then(handleResponse),

  // Coach workspace assignment endpoints
  getCoachWorkspace: () =>
    fetch("/api/coach/workspace", { cache: "no-store" }).then(handleResponse),
  assignLessonToPlayer: (playerId: string, payload: Record<string, unknown>) =>
    fetch(`/api/coach/players/${playerId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
  assignLessonToTeam: (teamId: string, payload: Record<string, unknown>) =>
    fetch(`/api/coach/teams/${teamId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse),
};

/**
 * Drop-in replacement for `fetch` that automatically tries to refresh the
 * access token once when the server returns 401, then retries the original
 * request.  If the refresh also fails the user is redirected to /login.
 *
 * A shared promise ensures that concurrent 401s only trigger one refresh
 * request instead of several racing ones.
 */
let refreshPromise: Promise<boolean> | null = null;

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;

  // Ensure only one refresh request is in flight at a time.
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  const refreshed = await refreshPromise;
  if (!refreshed) {
    // Refresh failed — send the user back to login.
    window.location.href = "/api/auth/logout";
    return res;
  }

  // Retry the original request with the new cookie that was just set.
  return fetch(input, init);
}
