"use client";

import { useState } from "react";
import { CalendarPlus, Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Feed = { token: string; lastAccessedAt: string | null };

function feedUrl(token: string) {
  return `${window.location.origin}/api/calendar/feed/ics/${token}.ics`;
}

/**
 * "Subscribe" on the calendar page: a private link for Apple Calendar,
 * Outlook or Google Calendar, so sessions show up next to everything else.
 */
export default function CalendarSubscribeButton({ role }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load(path: "" | "/rotate") {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/feed${path}`, {
        method: path ? "POST" : "GET",
      });
      if (!res.ok) throw new Error(String(res.status));
      setFeed((await res.json()) as Feed);
      if (path)
        toast.success("New link created. The old link no longer works.");
    } catch {
      toast.error("The calendar link could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!feed) return;
    try {
      await navigator.clipboard.writeText(feedUrl(feed.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed – select the link and copy it by hand.");
    }
  }

  const url = feed ? feedUrl(feed.token) : "";
  const webcal = url.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  const isCoach = role === "COACH" || role === "ADMIN";

  return (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => {
          setOpen(true);
          if (!feed) void load("");
        }}
      >
        <CalendarPlus className="h-4 w-4" />
        Subscribe
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add to your calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-slate-600">
            <p>
              {isCoach
                ? "Your team trainings with attendance, team events, scheduled sessions and your players' tournaments"
                : "Your team trainings, team events, coach sessions and tournaments"}{" "}
              show up in your own calendar app and update by themselves (usually
              within an hour).
            </p>

            {loading && !feed ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating your
                private link…
              </div>
            ) : feed ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <a
                    href={webcal}
                    className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--golf-primary)] px-4 font-medium text-white hover:opacity-90"
                  >
                    Apple Calendar / Outlook
                  </a>
                  <a
                    href={google}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Google Calendar
                  </a>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">
                    Or copy the link into any calendar app (“Subscribe to
                    calendar”):
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={url}
                      onFocus={(event) => event.currentTarget.select()}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs"
                      aria-label="Calendar link"
                    />
                    <Button
                      variant="outline"
                      className="h-11 shrink-0 gap-1.5"
                      onClick={() => void copy()}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span>
                    Keep this link private – anyone with it can see your
                    schedule.
                    {feed.lastAccessedAt
                      ? " Your calendar app is already using it."
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Create a new link? Calendars using the old link stop updating.",
                        )
                      ) {
                        void load("/rotate");
                      }
                    }}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 font-medium hover:bg-amber-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> New link
                  </button>
                </div>
              </>
            ) : (
              <Button variant="outline" onClick={() => void load("")}>
                Try again
              </Button>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
