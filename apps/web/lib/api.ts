export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  listTemplates: () => req("/task-templates"),
  listEvents: (playerId: string) => req(`/calendar/events?playerId=${playerId}`),
  createEvent: (payload: any) => req("/calendar/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEvent: (id: string, payload: any) => req(`/calendar/events/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createLog: (payload: any) => req("/task-logs", { method: "POST", body: JSON.stringify(payload) }),
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
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;

  // Ensure only one refresh request is in flight at a time.
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
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
