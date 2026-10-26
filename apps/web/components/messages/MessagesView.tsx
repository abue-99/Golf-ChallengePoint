"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCheck,
  HelpCircle,
  Loader2,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  X,
} from "lucide-react";
import TeamIcon from "@/components/TeamIcon";
import { openMission } from "@/components/game/MissionPlayer";
import { Sheet } from "@/components/game/bits";
import { loadPlayerWork } from "@/components/coach-game/AssignedWork";
import { focusMeta, gameApi } from "@/lib/game";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  dayHeading,
  initials,
  loadOverview,
  loadThread,
  MAX_MESSAGE_LENGTH,
  refreshUnread,
  sendMessage,
  shortTime,
  type ChatMessage,
  type Counterpart,
  type MessageRef,
  type MessagesOverview,
  type Thread,
} from "@/lib/messages";

const THREAD_POLL_MS = 8_000;
const LIST_POLL_MS = 30_000;

function Avatar({ person, size = 40 }: { person: Counterpart; size?: number }) {
  if (person.isTeam) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-800"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {person.icon ? <TeamIcon icon={person.icon} size={size * 0.5} /> : <span style={{ fontSize: size * 0.45 }}>👥</span>}
      </span>
    );
  }
  return person.profileImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.profileImage}
      alt=""
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(person.name)}
    </span>
  );
}

/**
 * Messages between coaches and players: a list of conversations and the
 * open chat side by side (PC/iPad), one after the other on the iPhone.
 */
export default function MessagesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("with");
  const [overview, setOverview] = useState<MessagesOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refreshList = useCallback(async () => {
    try {
      setOverview(await loadOverview());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load messages");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const tick = () =>
      loadOverview()
        .then((data) => {
          if (!active) return;
          setOverview(data);
          setError(null);
        })
        .catch((err: unknown) => {
          if (active) {
            setError(
              err instanceof Error ? err.message : "Could not load messages",
            );
          }
        });
    void tick();
    const timer = setInterval(() => {
      if (!document.hidden) void tick();
    }, LIST_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const select = (id: string | null) => {
    router.replace(
      id ? `/messages?with=${encodeURIComponent(id)}` : "/messages",
      {
        scroll: false,
      },
    );
  };

  const needle = query.trim().toLowerCase();
  const conversations = (overview?.conversations ?? []).filter(
    (row) => !needle || row.counterpart.name.toLowerCase().includes(needle),
  );
  const contacts = (overview?.contacts ?? []).filter(
    (person) => !needle || person.name.toLowerCase().includes(needle),
  );
  const selectedSummary = overview?.conversations.find(
    (row) => row.counterpart.id === selectedId,
  );
  const selectedContact =
    selectedSummary?.counterpart ??
    overview?.contacts.find((person) => person.id === selectedId) ??
    null;

  return (
    <div className="flex h-[calc(100dvh-var(--bottom-nav-height)-6.5rem)] min-h-[420px] overflow-hidden rounded-2xl border bg-white shadow-sm md:h-[calc(100dvh-6.5rem)]">
      {/* Conversation list */}
      <aside
        className={cn(
          "w-full flex-col border-r md:flex md:w-80 md:shrink-0",
          selectedId ? "hidden" : "flex",
        )}
      >
        <div className="border-b p-3">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">
            Messages
          </h1>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people and teams"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="m-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}
          {!overview && !error ? (
            <p className="flex items-center gap-2 p-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : null}
          {overview && conversations.length === 0 && contacts.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              {overview.me.isCoach
                ? "Your players appear here once you have linked players or teams."
                : "Your coaches appear here once you are linked to a coach or a team."}
            </p>
          ) : null}
          <ul>
            {conversations.map((row) => {
              const active = row.counterpart.id === selectedId;
              return (
                <li key={row.counterpart.id}>
                  <button
                    type="button"
                    onClick={() => select(row.counterpart.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                      active ? "bg-emerald-50" : "hover:bg-slate-50",
                    )}
                  >
                    <Avatar person={row.counterpart} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm text-slate-900",
                            row.unread > 0 ? "font-semibold" : "font-medium",
                          )}
                        >
                          {row.counterpart.name}
                        </span>
                        {row.lastMessage ? (
                          <span
                            className={cn(
                              "shrink-0 text-xs",
                              row.unread > 0
                                ? "font-semibold text-emerald-700"
                                : "text-slate-400",
                            )}
                          >
                            {shortTime(row.lastMessage.createdAt)}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm",
                            row.unread > 0
                              ? "text-slate-800"
                              : "text-slate-500",
                          )}
                        >
                          {row.lastMessage
                            ? `${row.lastMessage.mine ? "You: " : ""}${row.lastMessage.body}`
                            : ""}
                        </span>
                        {row.openQuestion ? (
                          <span
                            className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
                            title={
                              overview?.me.isCoach
                                ? "Your question is waiting for an answer"
                                : "Your coach is waiting for an answer"
                            }
                          >
                            {overview?.me.isCoach ? "Waiting" : "Question"}
                          </span>
                        ) : null}
                        {row.unread > 0 ? (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">
                            {row.unread}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {contacts.length > 0 ? (
            <div className="border-t">
              <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {overview?.me.isCoach ? "Your players" : "Your coaches"}
              </p>
              <ul>
                {contacts.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => select(person.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50",
                        person.id === selectedId && "bg-emerald-50",
                      )}
                    >
                      <Avatar person={person} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {person.name}
                        </span>
                        {person.label ? (
                          <span className="block truncate text-xs text-slate-500">
                            {person.label}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Chat */}
      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          selectedId ? "flex" : "hidden md:flex",
        )}
      >
        {selectedId ? (
          <ChatThread
            key={selectedId}
            userId={selectedId}
            fallback={selectedContact}
            label={selectedContact?.label ?? null}
            isCoach={Boolean(overview?.me.isCoach)}
            canWrite={selectedSummary ? selectedSummary.canWrite : true}
            onBack={() => select(null)}
            onChanged={() => void refreshList()}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-slate-500">
            <MessageCircle className="h-10 w-10 text-slate-300" />
            <p className="text-sm">
              Choose a conversation or a person to write to.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ChatThread({
  userId,
  fallback,
  label,
  isCoach,
  canWrite,
  onBack,
  onChanged,
}: {
  userId: string;
  fallback: Counterpart | null;
  label: string | null;
  isCoach: boolean;
  canWrite: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [asQuestion, setAsQuestion] = useState(false);
  const [attached, setAttached] = useState<MessageRef | null>(null);
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const isTeam = userId.startsWith("team:");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const stickToBottom = useRef(true);

  const scrollToBottom = () => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  };

  useEffect(() => {
    let cancelled = false;
    loadThread(userId)
      .then((data) => {
        if (cancelled) return;
        setThread(data);
        void refreshUnread();
        onChanged();
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load");
        }
      });
    return () => {
      cancelled = true;
    };
    // onChanged is stable enough; reloading the thread on each list refresh
    // would reset the scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // New messages while the chat is open.
  useEffect(() => {
    if (!thread) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      const last = thread.messages[thread.messages.length - 1];
      loadThread(userId, last ? { after: last.createdAt } : {})
        .then((data) => {
          setThread((current) => {
            if (!current) return data;
            const known = new Set(current.messages.map((m) => m.id));
            const fresh = data.messages.filter((m) => !known.has(m.id));
            if (
              fresh.length === 0 &&
              data.otherReadAt === current.otherReadAt
            ) {
              return current;
            }
            return {
              ...current,
              conversationId: data.conversationId ?? current.conversationId,
              otherReadAt: data.otherReadAt,
              messages: [...current.messages, ...fresh],
            };
          });
          if (data.messages.length > 0) {
            void refreshUnread();
            onChanged();
          }
        })
        .catch(() => undefined);
    }, THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [onChanged, thread, userId]);

  // Keep the newest message in view unless the user scrolled up.
  useEffect(() => {
    if (stickToBottom.current) scrollToBottom();
  }, [thread?.messages.length]);

  const loadOlder = async () => {
    if (!thread?.messages.length) return;
    setLoadingOlder(true);
    const box = scrollRef.current;
    const previousHeight = box?.scrollHeight ?? 0;
    try {
      const older = await loadThread(userId, {
        before: thread.messages[0].createdAt,
      });
      stickToBottom.current = false;
      setThread((current) =>
        current
          ? {
              ...current,
              hasMore: older.hasMore,
              messages: [...older.messages, ...current.messages],
            }
          : current,
      );
      requestAnimationFrame(() => {
        if (box) box.scrollTop = box.scrollHeight - previousHeight;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load");
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const message = await sendMessage(
        userId,
        body,
        isCoach && asQuestion && !isTeam,
        attached,
      );
      stickToBottom.current = true;
      setThread((current) =>
        current
          ? {
              ...current,
              conversationId: message.conversationId,
              messages: [...current.messages, message],
            }
          : current,
      );
      setDraft("");
      setAsQuestion(false);
      setAttached(null);
      onChanged();
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not sent");
    } finally {
      setSending(false);
    }
  };

  const person = thread?.counterpart ?? fallback;
  const messages = useMemo(() => thread?.messages ?? [], [thread]);
  // The coach's latest question without a player answer after it.
  const openQuestionId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.isQuestion) return message.id;
      if (isCoach ? !message.mine : message.mine) return null;
    }
    return null;
  }, [isCoach, messages]);
  const lastMine = [...messages].reverse().find((message) => message.mine);
  const seen = Boolean(
    !isTeam &&
    lastMine &&
    thread?.otherReadAt &&
    new Date(thread.otherReadAt) >= new Date(lastMine.createdAt),
  );

  return (
    <>
      <header className="flex items-center gap-3 border-b px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {person ? <Avatar person={person} size={38} /> : null}
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            {person?.name ?? "…"}
          </p>
          {label ? (
            <p className="truncate text-xs text-slate-500">{label}</p>
          ) : null}
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const box = event.currentTarget;
          stickToBottom.current =
            box.scrollHeight - box.scrollTop - box.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-slate-50 px-3 py-3"
      >
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        {!thread && !error ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : null}
        {thread?.hasMore ? (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {loadingOlder ? "Loading…" : "Earlier messages"}
            </button>
          </div>
        ) : null}
        {thread && messages.length === 0 ? (
          <div className="mx-auto mt-8 max-w-xs text-center text-sm text-slate-500">
            {isCoach
              ? "Send a tip, a note after training or ask a question – mark it as a question and it shows on the player's home until answered."
              : "Ask your coach anything – about a lesson, a training or your game."}
          </div>
        ) : null}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay =
            !previous ||
            new Date(previous.createdAt).toDateString() !==
              new Date(message.createdAt).toDateString();
          return (
            <div key={message.id}>
              {newDay ? (
                <p className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {dayHeading(message.createdAt)}
                </p>
              ) : null}
              <Bubble
                message={message}
                open={message.id === openQuestionId}
                isCoach={isCoach}
                showSender={
                  isTeam &&
                  !message.mine &&
                  (!previous || previous.senderId !== message.senderId || newDay)
                }
              />
            </div>
          );
        })}
        {seen ? (
          <p className="flex items-center justify-end gap-1 pr-1 text-[11px] text-slate-400">
            <CheckCheck className="h-3.5 w-3.5 text-emerald-600" /> Seen
          </p>
        ) : null}
      </div>

      {canWrite ? (
        <form
          className="border-t bg-white p-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {!isCoach && openQuestionId ? (
            <p className="px-1 pb-1.5 text-xs font-medium text-amber-800">
              Your coach is waiting for your answer.
            </p>
          ) : null}
          {isCoach && asQuestion ? (
            <p className="px-1 pb-1.5 text-xs text-amber-800">
              Sent as a question: it stays on the player&apos;s home until
              answered.
            </p>
          ) : null}
          {attached ? (
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                🎯 <span className="truncate">{attached.title}</span>
              </span>
              <button
                type="button"
                onClick={() => setAttached(null)}
                aria-label="Remove link"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            {!isTeam ? (
              <button
                type="button"
                onClick={() => setPicking(true)}
                aria-label="Link a mission"
                title="Link a mission"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            ) : null}
            {isCoach && !isTeam ? (
              <button
                type="button"
                onClick={() => setAsQuestion((value) => !value)}
                aria-pressed={asQuestion}
                title="Ask as a question"
                className={cn(
                  "flex h-11 shrink-0 items-center gap-1 rounded-full border px-3 text-sm",
                  asQuestion
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50",
                )}
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Question</span>
              </button>
            ) : null}
            <textarea
              ref={inputRef}
              value={draft}
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={
                isCoach && asQuestion ? "Ask a question…" : "Write a message…"
              }
              onChange={(event) => {
                setDraft(event.target.value);
                const el = event.target;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
              }}
              onKeyDown={(event) => {
                // Enter sends on a keyboard; on touch it adds a line break.
                const touch =
                  typeof window !== "undefined" &&
                  window.matchMedia("(pointer: coarse)").matches;
                if (event.key === "Enter" && !event.shiftKey && !touch) {
                  event.preventDefault();
                  void send();
                }
              }}
              className="max-h-[140px] min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[16px] leading-snug outline-none focus:border-emerald-400 focus:bg-white md:text-sm"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-opacity disabled:opacity-40"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>
      ) : (
        <p className="border-t bg-white p-3 text-center text-xs text-slate-500">
          You no longer work together – the conversation is read-only.
        </p>
      )}
      {picking ? (
        <MissionPicker
          isCoach={isCoach}
          playerId={userId}
          onClose={() => setPicking(false)}
          onPick={(ref) => {
            setAttached(ref);
            setPicking(false);
            inputRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}

type PickItem = { id: string; title: string; focusArea: string; detail: string };

/** Choose a mission to link: the coach picks from the player's missions, the player from their own. */
function MissionPicker({
  isCoach,
  playerId,
  onClose,
  onPick,
}: {
  isCoach: boolean;
  playerId: string;
  onClose: () => void;
  onPick: (ref: MessageRef) => void;
}) {
  const [items, setItems] = useState<PickItem[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = isCoach
      ? loadPlayerWork(playerId).then((work) =>
          work.map((item) => ({
            id: item.id,
            title: item.name,
            focusArea: item.focusArea,
            detail: `${item.status === "COMPLETED" ? "Done" : "Open"}${item.journey ? ` · ${item.journey}` : ""}`,
          })),
        )
      : gameApi.path().then((path) => {
          const all = [
            ...path.upNext,
            ...path.journeys.flatMap((journey) => journey.blocks.flatMap((block) => block.missions)),
            ...path.side,
            ...path.inbox.missions,
          ];
          const seen = new Set<string>();
          return all
            .filter((mission) => (seen.has(mission.id) ? false : (seen.add(mission.id), true)))
            .map((mission) => ({
              id: mission.id,
              title: mission.lesson.name,
              focusArea: mission.lesson.focusArea,
              detail: mission.status === "COMPLETED" ? "Done" : mission.locked ? "Locked" : "Open",
            }));
        });
    load
      .then((list) => !cancelled && setItems(list))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [isCoach, playerId]);
  return (
    <Sheet title="Link a mission" onClose={onClose}>
      {!items ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No missions to link.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick({ type: "assignment", id: item.id, title: item.title })}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-slate-50"
              >
                <span className="text-lg">{focusMeta(item.focusArea).emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{item.title}</span>
                  <span className="block text-xs text-slate-500">{item.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function Bubble({
  message,
  open,
  isCoach,
  showSender = false,
}: {
  message: ChatMessage;
  open: boolean;
  isCoach: boolean;
  showSender?: boolean;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return (
    <div className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3 py-2 text-[15px] leading-snug shadow-sm md:max-w-[70%] md:text-sm",
          message.mine
            ? "rounded-br-md bg-emerald-600 text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-800",
          message.isQuestion &&
            (message.mine
              ? "ring-2 ring-amber-300"
              : "border-amber-300 bg-amber-50"),
        )}
      >
        {message.isQuestion ? (
          <p
            className={cn(
              "mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide",
              message.mine ? "text-amber-100" : "text-amber-700",
            )}
          >
            <HelpCircle className="h-3 w-3" />
            {open
              ? isCoach
                ? "Question · waiting for answer"
                : "Question · please answer"
              : "Question"}
          </p>
        ) : null}
        {showSender && message.senderName ? (
          <p className={cn("mb-0.5 text-[11px] font-semibold", message.senderIsCoach ? "text-indigo-600" : "text-emerald-700")}>
            {message.senderName}
            {message.senderIsCoach ? " · Coach" : ""}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.refType === "assignment" && message.refId ? (
          <button
            type="button"
            onClick={() => (!isCoach && message.refId ? openMission(message.refId) : undefined)}
            disabled={isCoach}
            className={cn(
              "mt-1.5 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold",
              message.mine ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-900",
            )}
          >
            🎯 <span className="min-w-0 flex-1 truncate">{message.refTitle ?? "Mission"}</span>
            {!isCoach ? <span className="shrink-0 uppercase">Play ›</span> : null}
          </button>
        ) : null}
        <p
          className={cn(
            "mt-0.5 text-right text-[10px]",
            message.mine ? "text-emerald-100" : "text-slate-400",
          )}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
