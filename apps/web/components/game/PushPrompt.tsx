"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, X } from "lucide-react";
import { currentSubscription, loadPushSettings, pushSupport } from "@/lib/push";

const DISMISS_KEY = "gcp-push-prompt-dismissed";

/** Invites the player to switch on push (or to add the app to the Home Screen first). */
export default function PushPrompt() {
  const [mode, setMode] = useState<"install" | "enable" | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;
    const support = pushSupport();
    loadPushSettings()
      .then(async (settings) => {
        if (!settings.enabled) return;
        if (support.ios && !support.standalone) {
          setMode("install");
          return;
        }
        if (!support.supported) return;
        const subscription = await currentSubscription().catch(() => null);
        if (!subscription) setMode("enable");
      })
      .catch(() => null);
  }, []);

  if (!mode) return null;
  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setMode(null);
  }
  return (
    <div className="flex items-start gap-3 rounded-3xl bg-slate-900 p-4 text-white">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">Never miss a coach review</p>
        <p className="text-slate-300">
          {mode === "install"
            ? "Add the app to your Home Screen (Share → Add to Home Screen) to get notifications."
            : "Get a push when your coach sends a mission or reviews your work."}
        </p>
        <Link
          href="/settings/notifications"
          className="mt-2 inline-flex min-h-10 items-center rounded-full bg-amber-400 px-4 font-bold text-amber-950"
        >
          {mode === "install" ? "How it works" : "Turn on"}
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
