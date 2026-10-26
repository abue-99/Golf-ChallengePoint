"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  Clock,
  Loader2,
  Lock,
  Minus,
  Pause,
  Play,
  Plus,
  Target,
  Trophy,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  emitGameChanged,
  FEELINGS,
  focusMeta,
  gameApi,
  personName,
  type CompleteResult,
  type LevelInfo,
  type Mission,
} from "@/lib/game";
import {
  Confetti,
  CountUp,
  Overlay,
  PersonAvatar,
  ProgressBar,
  Stars,
} from "./bits";

// ── Open a mission from anywhere ─────────────────────────────────────

const openListeners = new Set<(id: string) => void>();

/** Opens the full-screen mission player (mounted once in the layout). */
export function openMission(id: string) {
  for (const listener of openListeners) listener(id);
}

/** Mounted once for players: shows the mission player for `?play=<id>` or `openMission()`. */
export function MissionHost() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get("play");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);
  const missionId =
    chosenId ?? (fromUrl && fromUrl !== dismissedUrl ? fromUrl : null);

  useEffect(() => {
    const listener = (id: string) => setChosenId(id);
    openListeners.add(listener);
    return () => {
      openListeners.delete(listener);
    };
  }, []);

  const close = useCallback(() => {
    setChosenId(null);
    if (fromUrl) {
      setDismissedUrl(fromUrl);
      router.replace(pathname);
    }
  }, [fromUrl, pathname, router]);

  if (!missionId) return null;
  return (
    <MissionPlayer
      key={missionId}
      missionId={missionId}
      onClose={close}
      onOpen={setChosenId}
    />
  );
}

// ── Timer that survives leaving the screen ───────────────────────────

type TimerState = { accumulated: number; startedAt: number | null };

function loadTimer(id: string): TimerState {
  try {
    const raw = window.localStorage.getItem(`gcp-mission-timer:${id}`);
    if (raw) {
      const parsed = JSON.parse(raw) as TimerState;
      if (typeof parsed.accumulated === "number") return parsed;
    }
  } catch {
    // storage unavailable
  }
  return { accumulated: 0, startedAt: null };
}

function saveTimer(id: string, state: TimerState | null) {
  try {
    if (state)
      window.localStorage.setItem(
        `gcp-mission-timer:${id}`,
        JSON.stringify(state),
      );
    else window.localStorage.removeItem(`gcp-mission-timer:${id}`);
  } catch {
    // storage unavailable
  }
}

function useMissionTimer(id: string) {
  const [state, setState] = useState<TimerState>({
    accumulated: 0,
    startedAt: null,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setState(loadTimer(id));
  }, [id]);
  useEffect(() => {
    if (!state.startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.startedAt]);
  const elapsed =
    state.accumulated +
    (state.startedAt ? Math.max(0, now - state.startedAt) : 0);
  const update = (next: TimerState) => {
    setState(next);
    saveTimer(id, next);
  };
  return {
    elapsed,
    running: Boolean(state.startedAt),
    start: () => {
      setNow(Date.now());
      update({ accumulated: state.accumulated, startedAt: Date.now() });
    },
    pause: () => update({ accumulated: elapsed, startedAt: null }),
    clear: () => {
      saveTimer(id, null);
      setState({ accumulated: 0, startedAt: null });
    },
  };
}

function clock(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ── Player ───────────────────────────────────────────────────────────

type Phase = "brief" | "play" | "finish" | "done";

export function MissionPlayer({
  missionId,
  onClose,
  onOpen,
}: {
  missionId: string;
  onClose: () => void;
  onOpen?: (id: string) => void;
}) {
  const router = useRouter();
  const [mission, setMission] = useState<Mission | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("brief");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number[]>([]);
  const [result, setResult] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [minutes, setMinutes] = useState<number | null>(null);
  const [completed, setCompleted] = useState<CompleteResult | null>(null);
  const [levelAfter, setLevelAfter] = useState<LevelInfo | null>(null);
  const timer = useMissionTimer(missionId);

  useEffect(() => {
    let cancelled = false;
    gameApi
      .mission(missionId)
      .then((data) => {
        if (cancelled) return;
        setMission(data);
        setDone(data.exercisesDone ?? []);
        setFeeling(data.selfAssessment);
        setNotes(data.playerNotes ?? "");
        if (data.status === "ACTIVE") setPhase("play");
        if (data.review && !data.review.seen)
          void gameApi.reviewsSeen(data.id).then(emitGameChanged);
      })
      .catch(
        (err: unknown) =>
          !cancelled &&
          setFailed(err instanceof Error ? err.message : "Could not load"),
      );
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  const meta = focusMeta(mission?.lesson.focusArea);
  const exercises = mission?.lesson.exercises ?? [];
  const target = mission?.lesson.targetScore ?? null;
  const attempts = mission?.lesson.targetAttempts ?? null;

  async function begin() {
    if (!mission) return;
    setBusy(true);
    try {
      if (mission.status === "PENDING")
        await gameApi.accept({ missionIds: [mission.id] });
      const started =
        mission.status === "COMPLETED"
          ? mission
          : await gameApi.start(mission.id);
      setMission({ ...mission, ...started });
      if (!timer.running) timer.start();
      setPhase("play");
      emitGameChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start the mission",
      );
    } finally {
      setBusy(false);
    }
  }

  function toFinish() {
    if (timer.running) timer.pause();
    // Timer used: its minutes; otherwise the planned duration.
    const timed = Math.round(timer.elapsed / 60000);
    setMinutes(
      (current) =>
        current ??
        (timed >= 1 ? timed : (mission?.lesson.durationMinutes ?? 0)),
    );
    setPhase("finish");
  }

  async function complete() {
    if (!mission) return;
    setBusy(true);
    try {
      const response = await gameApi.complete(mission.id, {
        exercisesDone: done,
        resultScore: target ? result : null,
        practiceMinutes: minutes,
        selfAssessment: feeling,
        playerNotes: notes.trim() || null,
      });
      timer.clear();
      setCompleted(response);
      setPhase("done");
      emitGameChanged();
      gameApi
        .me()
        .then((me) => setLevelAfter(me.level))
        .catch(() => null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not complete the mission",
      );
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <Overlay onClose={onClose} label="Mission" className="bg-white">
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-slate-700">{failed}</p>
          <button
            onClick={onClose}
            className="h-12 rounded-2xl bg-slate-900 px-6 font-semibold text-white"
          >
            Close
          </button>
        </div>
      </Overlay>
    );
  }

  if (!mission) {
    return (
      <Overlay onClose={onClose} label="Mission" className="bg-slate-950/80">
        <div className="flex h-full items-center justify-center text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Overlay>
    );
  }

  if (phase === "done" && completed) {
    return (
      <Celebration
        result={completed}
        level={levelAfter}
        onClose={onClose}
        onNext={
          completed.unlocked
            ? () => {
                onOpen?.(completed.unlocked!.id);
              }
            : undefined
        }
      />
    );
  }

  return (
    <Overlay
      onClose={onClose}
      label={mission.lesson.name}
      className="bg-slate-50"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div
          className="relative shrink-0 px-5 pb-5 text-white"
          style={{
            background: `linear-gradient(135deg, ${meta.color}, #0f172a)`,
            paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
          }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={phase === "finish" ? () => setPhase("play") : onClose}
              aria-label={phase === "finish" ? "Back" : "Close"}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"
            >
              {phase === "finish" ? (
                <ChevronLeft className="h-5 w-5" />
              ) : (
                <X className="h-5 w-5" />
              )}
            </button>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              {meta.emoji} {meta.label}
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold leading-tight">
            {mission.lesson.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/80">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <Clock className="h-3.5 w-3.5" /> {mission.lesson.durationMinutes}{" "}
              min
            </span>
            {target ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                <Target className="h-3.5 w-3.5" /> Goal {target}
                {attempts ? ` of ${attempts}` : ""}
              </span>
            ) : null}
            {mission.dueDate ? (
              <span className="rounded-full bg-white/15 px-2.5 py-1">
                Due{" "}
                {new Date(mission.dueDate).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            ) : null}
            {mission.journeyName ? (
              <span className="rounded-full bg-white/15 px-2.5 py-1">
                {mission.journeyName}
              </span>
            ) : null}
          </div>
          {phase === "play" ? (
            <div className="mt-4 flex items-center gap-3">
              <span className="font-mono text-4xl font-bold tabular-nums">
                {clock(timer.elapsed)}
              </span>
              <button
                type="button"
                onClick={timer.running ? timer.pause : timer.start}
                className="flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-slate-900"
              >
                {timer.running ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {timer.running ? "Pause" : "Resume"}
              </button>
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {phase === "brief" ? (
            <Brief mission={mission} />
          ) : phase === "play" ? (
            <div className="space-y-5">
              {mission.lesson.trainingObjective ? (
                <p className="rounded-2xl bg-white p-4 text-sm font-medium text-slate-800 shadow-sm">
                  🎯 {mission.lesson.trainingObjective}
                </p>
              ) : null}
              {exercises.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Exercises · {done.length}/{exercises.length}
                  </p>
                  <ul className="space-y-2">
                    {exercises.map((exercise, index) => {
                      const ticked = done.includes(index);
                      return (
                        <li key={index}>
                          <button
                            type="button"
                            onClick={() =>
                              setDone((prev) =>
                                prev.includes(index)
                                  ? prev.filter((i) => i !== index)
                                  : [...prev, index],
                              )
                            }
                            className={cn(
                              "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all",
                              ticked
                                ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                : "border-slate-200 bg-white text-slate-800",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                                ticked
                                  ? "game-pop border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300",
                              )}
                            >
                              {ticked ? <Check className="h-4 w-4" /> : null}
                            </span>
                            {exercise}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {target ? (
                <ResultStepper
                  value={result}
                  onChange={setResult}
                  target={target}
                  attempts={attempts}
                />
              ) : null}
              {mission.lesson.successCriteria ? (
                <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <span className="font-semibold">Success: </span>
                  {mission.lesson.successCriteria}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-center text-sm font-semibold text-slate-700">
                  How did it feel?
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {FEELINGS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFeeling(option.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-2xl border-2 py-3 text-xs font-semibold transition-all",
                        feeling === option.value
                          ? "game-pop border-amber-400 bg-amber-50 text-amber-900"
                          : "border-slate-200 bg-white text-slate-500",
                      )}
                    >
                      <span className="text-2xl">{option.emoji}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Minutes practised
                </p>
                <div className="flex items-center gap-3">
                  <StepButton
                    onClick={() => setMinutes((m) => Math.max(0, (m ?? 0) - 5))}
                    label="Less"
                  >
                    <Minus className="h-5 w-5" />
                  </StepButton>
                  <span className="min-w-16 text-center text-2xl font-bold tabular-nums">
                    {minutes ?? 0}
                  </span>
                  <StepButton
                    onClick={() =>
                      setMinutes((m) => Math.min(600, (m ?? 0) + 5))
                    }
                    label="More"
                  >
                    <Plus className="h-5 w-5" />
                  </StepButton>
                  <span className="text-sm text-slate-500">
                    of {mission.lesson.durationMinutes} planned
                  </span>
                </div>
              </div>
              <div>
                <label
                  htmlFor="mission-notes"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Note for your coach{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="mission-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="What worked? What was hard?"
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action */}
        <div
          className="shrink-0 border-t border-slate-200 bg-white px-5 pt-3"
          style={{
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          {phase === "brief" ? (
            mission.locked ? (
              <p className="flex h-14 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
                <Lock className="h-4 w-4" /> Finish the step before to unlock
                this mission
              </p>
            ) : (
              <div className="flex gap-2">
                {mission.status !== "COMPLETED" ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push("/calendar");
                    }}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 text-slate-600"
                    aria-label="Schedule in the calendar"
                  >
                    <CalendarPlus className="h-5 w-5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void begin()}
                  disabled={busy}
                  className="game-shine flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-extrabold uppercase tracking-wide text-white shadow-lg shadow-emerald-600/30 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5 fill-white" />
                  )}
                  {mission.status === "COMPLETED"
                    ? "Play again"
                    : mission.status === "PENDING"
                      ? "Accept & play"
                      : "Start mission"}
                </button>
              </div>
            )
          ) : phase === "play" ? (
            <button
              type="button"
              onClick={toFinish}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-lg font-extrabold uppercase tracking-wide text-white"
            >
              <Check className="h-5 w-5" /> Finish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void complete()}
              disabled={busy}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-extrabold uppercase tracking-wide text-white shadow-lg shadow-emerald-600/30 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Trophy className="h-5 w-5" />
              )}
              Complete mission
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-700 active:scale-95"
    >
      {children}
    </button>
  );
}

function ResultStepper({
  value,
  onChange,
  target,
  attempts,
}: {
  value: number | null;
  onChange: (value: number) => void;
  target: number;
  attempts: number | null;
}) {
  const current = value ?? 0;
  const max = attempts ?? 1000;
  const reached = current >= target;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Your result
      </p>
      <div className="mt-3 flex items-center justify-center gap-4">
        <StepButton
          onClick={() => onChange(Math.max(0, current - 1))}
          label="Minus one"
        >
          <Minus className="h-5 w-5" />
        </StepButton>
        <div className="text-center">
          <span
            className={cn(
              "text-5xl font-extrabold tabular-nums",
              reached ? "text-emerald-600" : "text-slate-900",
            )}
          >
            {current}
          </span>
          {attempts ? (
            <span className="text-xl font-bold text-slate-400">
              {" "}
              / {attempts}
            </span>
          ) : null}
        </div>
        <StepButton
          onClick={() => onChange(Math.min(max, current + 1))}
          label="Plus one"
        >
          <Plus className="h-5 w-5" />
        </StepButton>
      </div>
      <p
        className={cn(
          "mt-2 text-center text-sm font-semibold",
          reached ? "text-emerald-700" : "text-slate-500",
        )}
      >
        {reached
          ? "🎯 Goal reached – 3 stars!"
          : `Goal: ${target}${attempts ? ` of ${attempts}` : ""}`}
      </p>
    </div>
  );
}

function Brief({ mission }: { mission: Mission }) {
  return (
    <div className="space-y-4">
      {mission.review ? <ReviewBox mission={mission} /> : null}
      {mission.status === "COMPLETED" && mission.stars ? (
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
          <span className="text-sm font-semibold text-slate-700">
            Your best
          </span>
          <Stars value={mission.stars} size={22} />
        </div>
      ) : null}
      {mission.lesson.trainingObjective ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Mission
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {mission.lesson.trainingObjective}
          </p>
        </div>
      ) : null}
      {mission.lesson.description ? (
        <p className="whitespace-pre-line px-1 text-sm text-slate-600">
          {mission.lesson.description}
        </p>
      ) : null}
      {mission.lesson.exercises.length > 0 ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Exercises
          </p>
          <ol className="space-y-1.5 text-sm text-slate-800">
            {mission.lesson.exercises.map((exercise, index) => (
              <li key={index} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                  {index + 1}
                </span>
                {exercise}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {mission.lesson.successCriteria ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span className="font-semibold">Success: </span>
          {mission.lesson.successCriteria}
        </p>
      ) : null}
      {mission.lesson.videoUrl ? (
        <a
          href={mission.lesson.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-sky-700 shadow-sm"
        >
          <Video className="h-4 w-4" /> Watch the video
        </a>
      ) : null}
      <div className="flex items-center gap-3 px-1 text-sm text-slate-500">
        <PersonAvatar person={mission.coach} size={28} />
        From {personName(mission.coach) || "your coach"}
        {mission.team
          ? ` · ${mission.team.icon ?? "👥"} ${mission.team.shortName}`
          : ""}
      </div>
    </div>
  );
}

export function ReviewBox({ mission }: { mission: Mission }) {
  if (!mission.review) return null;
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        mission.review.pick
          ? "border-amber-300 bg-amber-50"
          : "border-sky-100 bg-sky-50",
      )}
    >
      <div className="flex items-center gap-3">
        <PersonAvatar person={mission.review.by} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {personName(mission.review.by) || "Your coach"}
            {mission.review.pick ? (
              <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-amber-950">
                🏅 Coach&apos;s pick
              </span>
            ) : null}
          </p>
          <Stars value={mission.review.rating} max={5} size={16} />
        </div>
      </div>
      {mission.review.comment ? (
        <p className="mt-2 whitespace-pre-line text-sm text-slate-800">
          “{mission.review.comment}”
        </p>
      ) : null}
    </div>
  );
}

// ── Celebration ──────────────────────────────────────────────────────

export function Celebration({
  result,
  level,
  onClose,
  onNext,
}: {
  result: CompleteResult;
  level: LevelInfo | null;
  onClose: () => void;
  onNext?: () => void;
}) {
  const { outcome } = result;
  const levelUp = outcome.levelAfter > outcome.levelBefore;
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    timers.current = [400, 1200, 2000].map((delay, index) =>
      window.setTimeout(() => setStep(index + 1), delay),
    );
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, []);
  const missionXp = useMemo(
    () =>
      outcome.events
        .filter((event) => event.type === "LESSON_COMPLETED")
        .reduce((sum, e) => sum + e.xp, 0),
    [outcome.events],
  );

  return (
    <Overlay
      onClose={onClose}
      label="Mission complete"
      className="bg-gradient-to-b from-emerald-700 via-emerald-800 to-slate-950 text-white"
    >
      <Confetti pieces={levelUp ? 90 : 60} />
      <div
        className="flex h-full flex-col items-center overflow-y-auto px-6 text-center"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
        }}
      >
        <p className="game-rise text-sm font-bold uppercase tracking-[0.3em] text-emerald-200">
          Mission complete
        </p>
        <h1 className="game-rise mt-2 text-3xl font-extrabold">
          {result.mission.lesson.name}
        </h1>
        <div className="mt-5">
          <Stars value={result.stars} size={52} animate />
        </div>
        <div
          className="game-pop mt-6 rounded-3xl bg-white/10 px-8 py-4"
          style={{ animationDelay: "0.6s" }}
        >
          <p className="text-5xl font-black text-amber-300">
            +<CountUp value={outcome.xpGained} /> XP
          </p>
          {missionXp && missionXp !== outcome.xpGained ? (
            <p className="mt-1 text-xs text-emerald-100">
              Mission {missionXp} XP + bonuses
            </p>
          ) : null}
        </div>

        {level ? (
          <div className="mt-6 w-full max-w-sm">
            <div className="mb-1 flex justify-between text-xs font-semibold text-emerald-100">
              <span>Level {level.level}</span>
              <span>
                {level.xp - level.levelStartXp}/
                {level.nextLevelXp - level.levelStartXp} XP
              </span>
            </div>
            <ProgressBar
              value={step >= 1 ? level.progress : 0}
              className="h-3 bg-white/15"
              barClassName="bg-gradient-to-r from-amber-400 to-yellow-200"
            />
          </div>
        ) : null}

        {levelUp && step >= 1 ? (
          <div className="game-pop mt-6 w-full max-w-sm rounded-3xl bg-gradient-to-r from-amber-400 to-yellow-300 p-4 text-amber-950 game-glow">
            <p className="text-xs font-black uppercase tracking-widest">
              Level up!
            </p>
            <p className="text-3xl font-black">Level {outcome.levelAfter}</p>
          </div>
        ) : null}

        {step >= 2 &&
        (outcome.newBadges.length > 0 ||
          outcome.questsDone.length > 0 ||
          outcome.weekGoalReached) ? (
          <div className="mt-6 w-full max-w-sm space-y-2">
            {outcome.newBadges.map((badge) => (
              <div
                key={badge.key}
                className="game-pop flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-left"
              >
                <span className="text-3xl">{badge.emoji}</span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    New badge
                  </p>
                  <p className="font-bold">{badge.title}</p>
                </div>
              </div>
            ))}
            {outcome.weekGoalReached ? (
              <div className="game-pop flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-left">
                <span className="text-3xl">🔥</span>
                <p className="font-bold">Weekly goal reached!</p>
              </div>
            ) : null}
            {outcome.questsDone.map((quest) => (
              <div
                key={quest}
                className="game-pop flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-left"
              >
                <span className="text-3xl">✅</span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
                    Quest done
                  </p>
                  <p className="font-bold">{quest}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {result.unlocked && step >= 3 ? (
          <div className="game-rise mt-6 w-full max-w-sm rounded-2xl border border-white/20 p-4 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              🔓 New mission unlocked
            </p>
            <p className="font-bold">{result.unlocked.name}</p>
          </div>
        ) : null}

        <div className="mt-auto w-full max-w-sm space-y-2 pt-8">
          {onNext ? (
            <button
              type="button"
              onClick={onNext}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-lg font-extrabold uppercase tracking-wide text-amber-950"
            >
              <Play className="h-5 w-5 fill-amber-950" /> Next mission
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex h-14 w-full items-center justify-center rounded-2xl text-lg font-extrabold uppercase tracking-wide",
              onNext ? "bg-white/10 text-white" : "bg-white text-emerald-800",
            )}
          >
            Continue
          </button>
        </div>
      </div>
    </Overlay>
  );
}
