"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HelpCircle, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import {
  loadOverview,
  refreshUnread,
  sendMessage,
  shortTime,
  type ConversationSummary,
} from "@/lib/messages";

/**
 * Player home: questions from coaches waiting for an answer (answer right
 * here) and new messages.
 */
export default function CoachMessagesCard() {
  const [rows, setRows] = useState<ConversationSummary[] | null>(null);

  const load = () =>
    loadOverview()
      .then((data) => setRows(data.conversations))
      .catch(() => setRows([]));

  useEffect(() => {
    void load();
  }, []);

  if (!rows) return null;
  const questions = rows.filter((row) => row.openQuestion).slice(0, 2);
  const unreadRows = rows.filter((row) => row.unread > 0 && !row.openQuestion);
  if (questions.length === 0 && unreadRows.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      {questions.map((row) => (
        <QuestionReply
          key={row.counterpart.id}
          row={row}
          onAnswered={() => {
            void load();
            void refreshUnread();
          }}
        />
      ))}
      {unreadRows.length > 0 ? (
        <Link
          href={
            unreadRows.length === 1
              ? `/messages?with=${encodeURIComponent(unreadRows[0].counterpart.id)}`
              : "/messages"
          }
          className="flex items-center gap-3 rounded-xl bg-sky-50 px-3 py-2.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">
              {unreadRows.reduce((sum, row) => sum + row.unread, 0)} new message
              {unreadRows.reduce((sum, row) => sum + row.unread, 0) === 1
                ? ""
                : "s"}
            </span>
            <span className="block truncate text-xs text-slate-600">
              from {unreadRows.map((row) => row.counterpart.name).join(", ")}
            </span>
          </span>
          <span className="text-sm font-semibold text-sky-700">Open</span>
        </Link>
      ) : null}
    </div>
  );
}

function QuestionReply({
  row,
  onAnswered,
}: {
  row: ConversationSummary;
  onAnswered: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const question = row.openQuestion;
  if (!question) return null;

  const send = async () => {
    if (!answer.trim()) return;
    setSending(true);
    try {
      await sendMessage(row.counterpart.id, answer.trim());
      toast.success(`Answer sent to ${row.counterpart.name}.`);
      setAnswer("");
      onAnswered();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not sent");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <HelpCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {row.counterpart.name} asked · {shortTime(question.createdAt)}
          </p>
          <p className="whitespace-pre-wrap text-[15px] text-slate-900">
            {question.body}
          </p>
        </div>
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          value={answer}
          rows={1}
          maxLength={2000}
          placeholder="Your answer…"
          onChange={(event) => {
            setAnswer(event.target.value);
            const el = event.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[16px] leading-snug outline-none focus:border-emerald-400 focus:bg-white"
        />
        <button
          type="submit"
          disabled={!answer.trim() || sending}
          aria-label="Send answer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
      <Link
        href={`/messages?with=${encodeURIComponent(row.counterpart.id)}`}
        className="block text-xs font-medium text-emerald-700"
      >
        Open the chat →
      </Link>
    </div>
  );
}
