"use client";

import { useSyncExternalStore } from "react";

/** Messages between coaches and players (client side). */

export type Counterpart = {
  id: string;
  name: string;
  profileImage: string | null;
  label?: string | null;
};

export type ConversationSummary = {
  counterpart: Counterpart;
  canWrite: boolean;
  lastMessage: { body: string; mine: boolean; createdAt: string } | null;
  unread: number;
  openQuestion: { id: string; body: string; createdAt: string } | null;
};

export type MessagesOverview = {
  me: { id: string; isCoach: boolean };
  conversations: ConversationSummary[];
  contacts: Counterpart[];
};

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  isQuestion: boolean;
  createdAt: string;
  mine: boolean;
};

export type Thread = {
  counterpart: Counterpart;
  conversationId: string | null;
  messages: ChatMessage[];
  otherReadAt: string | null;
  hasMore: boolean;
};

export const MAX_MESSAGE_LENGTH = 2000;
const UNREAD_POLL_MS = 30_000;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export function loadOverview() {
  return call<MessagesOverview>("/api/messages");
}

export function loadThread(
  userId: string,
  options: { after?: string; before?: string } = {},
) {
  const params = new URLSearchParams();
  if (options.after) params.set("after", options.after);
  if (options.before) params.set("before", options.before);
  const query = params.toString();
  return call<Thread>(
    `/api/messages/with/${encodeURIComponent(userId)}${query ? `?${query}` : ""}`,
  );
}

export function sendMessage(userId: string, body: string, isQuestion = false) {
  return call<ChatMessage & { conversationId: string }>(
    `/api/messages/with/${encodeURIComponent(userId)}`,
    { method: "POST", body: JSON.stringify({ body, isQuestion }) },
  );
}

// ── Unread badge: one shared poll for the navigation and all pages ────────

type Unread = { total: number; byUser: Record<string, number> };
let unread: Unread | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

export async function refreshUnread() {
  if (inFlight) return;
  if (typeof document !== "undefined" && document.hidden && unread) return;
  inFlight = true;
  try {
    unread = await call<Unread>("/api/messages/unread");
    listeners.forEach((listener) => listener());
  } catch {
    // Keep the last value; the next poll tries again.
  } finally {
    inFlight = false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    void refreshUnread();
    timer = setInterval(() => void refreshUnread(), UNREAD_POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useUnreadMessages() {
  return useSyncExternalStore(
    subscribe,
    () => unread,
    () => null,
  );
}

// ── Formatting ────────────────────────────────────────────────────────────

/** "14:05", "Yesterday", "Tue", "12 Oct" for list rows. */
export function shortTime(value: string, now = new Date()) {
  const date = new Date(value);
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function dayHeading(value: string, now = new Date()) {
  const date = new Date(value);
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
