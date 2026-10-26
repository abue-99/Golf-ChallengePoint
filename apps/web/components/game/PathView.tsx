"use client";

import { useState } from "react";
import { Check, ChevronDown, Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  focusMeta,
  gameApi,
  personName,
  useGameData,
  type JourneyPath,
  type Mission,
} from "@/lib/game";
import { ProgressBar, SectionTitle, Stars } from "./bits";
import { openMission } from "./MissionPlayer";
import { InboxCard } from "./PlayerHome";

const ZIGZAG = [0, 56, 84, 56, 0, -56, -84, -56];

export default function PathView() {
  const { data, loading, error, reload } = useGameData(gameApi.path);
  const [showDone, setShowDone] = useState(false);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="h-24 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-96 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }
  if (!data) {
    return (
      <p className="mx-auto max-w-lg rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
        {error ?? "Missions could not be loaded."}{" "}
        <button className="underline" onClick={() => void reload()}>
          Try again
        </button>
      </p>
    );
  }

  const openSide = data.side.filter(
    (mission) => mission.status !== "COMPLETED",
  );
  const doneSide = data.side.filter(
    (mission) => mission.status === "COMPLETED",
  );
  const nothing =
    data.journeys.length === 0 &&
    data.side.length === 0 &&
    data.inbox.journeys.length + data.inbox.missions.length === 0;

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-6">
      <header className="px-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          My path
        </h1>
        <p className="text-sm text-slate-500">
          Play your missions step by step. Every mission earns XP.
        </p>
      </header>

      <InboxCard path={data} />

      {nothing ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-4xl">⛳</p>
          <p className="mt-2 font-bold text-slate-800">No missions yet</p>
          <p className="mt-1 text-sm text-slate-500">
            As soon as your coach sends you a mission or a journey, it shows up
            here.
          </p>
        </div>
      ) : null}

      {data.journeys.map((journey) => (
        <JourneyMap key={journey.planId} journey={journey} />
      ))}

      {openSide.length > 0 ? (
        <section>
          <SectionTitle>Side missions</SectionTitle>
          <ul className="space-y-2">
            {openSide.map((mission) => (
              <MissionRow key={mission.id} mission={mission} />
            ))}
          </ul>
        </section>
      ) : null}

      {doneSide.length > 0 ? (
        <section>
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            className="mb-2 flex min-h-11 w-full items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Completed side missions ({doneSide.length})
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                showDone ? "rotate-180" : "",
              )}
            />
          </button>
          {showDone ? (
            <ul className="space-y-2">
              {doneSide.map((mission) => (
                <MissionRow key={mission.id} mission={mission} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MissionRow({ mission }: { mission: Mission }) {
  const meta = focusMeta(mission.lesson.focusArea);
  const done = mission.status === "COMPLETED";
  return (
    <li>
      <button
        type="button"
        onClick={() => openMission(mission.id)}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
          style={{ background: `${meta.color}22` }}
        >
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-semibold",
              done ? "text-slate-500" : "text-slate-900",
            )}
          >
            {mission.lesson.name}
          </p>
          <p className="text-xs text-slate-500">
            {meta.label} · {mission.lesson.durationMinutes} min
            {mission.dueDate && !done
              ? ` · due ${new Date(mission.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
              : ""}
            {mission.isTeam && mission.team
              ? ` · ${mission.team.shortName}`
              : ""}
          </p>
        </div>
        {done ? (
          <div className="flex flex-col items-end gap-0.5">
            <Stars value={mission.stars ?? 1} size={14} />
            {mission.review ? (
              <span className="text-[10px] font-semibold text-sky-700">
                Reviewed {"★".repeat(mission.review.rating)}
              </span>
            ) : null}
          </div>
        ) : mission.status === "ACTIVE" ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
            In play
          </span>
        ) : (
          <Play className="h-5 w-5 fill-emerald-600 text-emerald-600" />
        )}
      </button>
    </li>
  );
}

function JourneyMap({ journey }: { journey: JourneyPath }) {
  const percent = journey.total
    ? Math.round((journey.done / journey.total) * 100)
    : 0;
  const complete = journey.done === journey.total;
  const order = new Map(
    journey.blocks
      .flatMap((block) => block.missions)
      .map((mission, position) => [mission.id, position]),
  );
  // The first playable mission of the whole journey glows.
  const current = journey.blocks
    .flatMap((block) => block.missions)
    .find((mission) => !mission.locked && mission.status !== "COMPLETED");

  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
          Journey
          {journey.team
            ? ` · ${journey.team.icon ?? "👥"} ${journey.team.shortName}`
            : ""}
        </p>
        <h2 className="text-xl font-extrabold">{journey.name}</h2>
        <p className="text-xs text-slate-300">
          by {personName(journey.coach) || "your coach"}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={percent} className="h-2.5 flex-1 bg-white/15" />
          <span className="text-sm font-bold">
            {journey.done}/{journey.total}
          </span>
        </div>
      </div>

      <div className="relative px-4 py-6">
        {journey.blocks.map((block, blockIndex) => {
          const blockDone =
            block.missions.length > 0 &&
            block.missions.every((m) => m.status === "COMPLETED");
          return (
            <div key={block.id} className="relative">
              {journey.blocks.length > 1 ? (
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {blockIndex + 1}. {block.name}
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
              ) : null}
              <ol className="flex flex-col items-center gap-5">
                {block.missions.map((mission) => (
                  <PathNode
                    key={mission.id}
                    mission={mission}
                    offset={
                      ZIGZAG[(order.get(mission.id) ?? 0) % ZIGZAG.length]
                    }
                    current={current?.id === mission.id}
                  />
                ))}
              </ol>
              {journey.blocks.length > 1 ? (
                <div className="my-5 flex justify-center">
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl text-3xl",
                      blockDone
                        ? "game-pop bg-amber-100"
                        : "bg-slate-100 grayscale",
                    )}
                    title={
                      blockDone
                        ? "Block complete: +150 XP"
                        : "Finish the block to open the chest"
                    }
                  >
                    {blockDone ? "🎁" : "📦"}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="mt-2 flex flex-col items-center gap-1">
          <span
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full text-4xl",
              complete ? "game-pop bg-amber-100" : "bg-slate-100 grayscale",
            )}
          >
            🏆
          </span>
          <span className="text-xs font-semibold text-slate-500">
            {complete
              ? "Journey complete · +500 XP"
              : "Finish the journey: +500 XP"}
          </span>
        </div>
      </div>
    </section>
  );
}

function PathNode({
  mission,
  offset,
  current,
}: {
  mission: Mission;
  offset: number;
  current: boolean;
}) {
  const meta = focusMeta(mission.lesson.focusArea);
  const done = mission.status === "COMPLETED";
  const locked = mission.locked;
  return (
    <li
      className="flex flex-col items-center"
      style={{ transform: `translateX(${offset}px)` }}
    >
      {current ? (
        <span className="mb-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold uppercase text-white shadow">
          {mission.status === "ACTIVE" ? "Continue" : "Start"}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => openMission(mission.id)}
        aria-label={`${mission.lesson.name}${locked ? " (locked)" : done ? " (done)" : ""}`}
        className={cn(
          "relative flex h-[68px] w-[68px] items-center justify-center rounded-full border-b-[6px] text-3xl transition-transform active:translate-y-1",
          done
            ? "border-emerald-700 bg-emerald-500 text-white"
            : locked
              ? "border-slate-300 bg-slate-200 text-slate-400"
              : current
                ? "game-glow border-amber-600 bg-amber-400"
                : "border-slate-300 bg-white",
        )}
        style={
          !done && !locked && !current ? { borderColor: meta.color } : undefined
        }
      >
        {done ? (
          <Check className="h-8 w-8" strokeWidth={3} />
        ) : locked ? (
          <Lock className="h-6 w-6" />
        ) : (
          meta.emoji
        )}
        {mission.status === "ACTIVE" ? (
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-white">
            <Play className="h-3 w-3 fill-white" />
          </span>
        ) : null}
        {mission.review ? (
          <span className="absolute -bottom-1 -right-2 rounded-full bg-sky-600 px-1.5 text-[10px] font-bold text-white">
            {mission.review.pick ? "🏅" : `${mission.review.rating}★`}
          </span>
        ) : null}
      </button>
      <span
        className={cn(
          "mt-2 max-w-40 text-center text-xs font-semibold",
          locked ? "text-slate-400" : "text-slate-700",
        )}
      >
        {mission.lesson.name}
      </span>
      {done ? (
        <Stars value={mission.stars ?? 1} size={12} className="mt-0.5" />
      ) : null}
    </li>
  );
}
