"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  currentSubscription,
  disablePush,
  enablePush,
  loadPushSettings,
  pushSupport,
  savePushPrefs,
  sendTestPush,
  type PushSettings,
} from "@/lib/push";

export default function NotificationsPage() {
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [support, setSupport] = useState({
    supported: false,
    standalone: false,
    ios: false,
  });

  useEffect(() => {
    setSupport(pushSupport());
    loadPushSettings()
      .then(setSettings)
      .catch(() => toast.error("Settings could not be loaded"));
    currentSubscription()
      .then((subscription) => setSubscribed(Boolean(subscription)))
      .catch(() => null);
  }, []);

  async function toggleDevice() {
    if (!settings?.publicKey) return;
    setBusy(true);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        toast.success("Notifications switched off on this device");
      } else {
        await enablePush(settings.publicKey);
        setSubscribed(true);
        toast.success("Notifications switched on 🔔");
      }
      setSettings(await loadPushSettings());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not change notifications",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleKind(key: string) {
    if (!settings) return;
    const next = { ...settings.prefs, [key]: !settings.prefs[key] };
    setSettings({ ...settings, prefs: next });
    try {
      setSettings(await savePushPrefs({ [key]: next[key] }));
    } catch {
      toast.error("Could not save");
    }
  }

  const needsInstall = support.ios && !support.standalone;

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-6">
      <header className="px-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Notifications
        </h1>
        <p className="text-sm text-slate-500">
          Push messages on your phone – no e-mails.
        </p>
      </header>

      {!settings ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : !settings.enabled ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          Push notifications are not set up on the server yet (VAPID keys
          missing).
        </p>
      ) : needsInstall ? (
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <p className="font-bold text-slate-900">
            First add the app to your Home Screen
          </p>
          <p className="text-sm text-slate-600">
            On the iPhone, notifications only work for the app on your Home
            Screen.
          </p>
          <ol className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              1. Tap <Share className="h-4 w-4" /> <b>Share</b> in Safari
            </li>
            <li className="flex items-center gap-2">
              2. Choose <SquarePlus className="h-4 w-4" />{" "}
              <b>Add to Home Screen</b>
            </li>
            <li>
              3. Open Golf ChallengePoint from the Home Screen and come back
              here.
            </li>
          </ol>
        </div>
      ) : !support.supported ? (
        <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
          This browser does not support push notifications.
        </p>
      ) : (
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <BellRing className="h-6 w-6 text-emerald-600" />
            <div className="flex-1">
              <p className="font-bold text-slate-900">This device</p>
              <p className="text-xs text-slate-500">
                {subscribed ? "Notifications are on" : "Notifications are off"}{" "}
                · {settings.devices} device
                {settings.devices === 1 ? "" : "s"} registered
              </p>
            </div>
            <Switch
              on={subscribed}
              busy={busy}
              onClick={() => void toggleDevice()}
              label="Notifications on this device"
            />
          </div>
          {subscribed ? (
            <button
              type="button"
              onClick={() =>
                void sendTestPush().then((sent) =>
                  sent > 0
                    ? toast.success("Test sent")
                    : toast.error(
                        "Nothing was delivered – check the system settings",
                      ),
                )
              }
              className="min-h-11 w-full rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700"
            >
              Send a test notification
            </button>
          ) : null}
        </div>
      )}

      {settings ? (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm">
          {settings.kinds.map((kind) => (
            <div
              key={kind.key}
              className="flex min-h-14 items-center gap-3 px-5"
            >
              <span className="flex-1 text-sm font-medium text-slate-800">
                {kind.label}
              </span>
              <Switch
                on={Boolean(settings.prefs[kind.key])}
                onClick={() => void toggleKind(kind.key)}
                label={kind.label}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Switch({
  on,
  busy,
  onClick,
  label,
}: {
  on: boolean;
  busy?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className="flex h-11 w-14 items-center justify-center"
    >
      <span
        className={cn(
          "h-7 w-12 rounded-full p-0.5 transition-colors",
          on ? "bg-emerald-600" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "block h-6 w-6 rounded-full bg-white shadow transition-transform",
            on ? "translate-x-5" : "",
          )}
        />
      </span>
    </button>
  );
}
