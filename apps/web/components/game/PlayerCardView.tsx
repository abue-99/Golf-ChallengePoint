"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  focusMeta,
  TIER_STYLE,
  type Attribute,
  type LevelInfo,
  type PlayerCard,
} from "@/lib/game";
import { PersonAvatar } from "./bits";

/** FUT-style card: OVR, tier, the 7 attributes. Values only from real data. */
export function PlayerCardFace({
  card,
  level,
  name,
  person,
  className,
}: {
  card: PlayerCard;
  level: LevelInfo;
  name: string;
  person: {
    firstName: string | null;
    lastName: string | null;
    profileImage?: string | null;
  };
  className?: string;
}) {
  const tier = TIER_STYLE[card.tier];
  return (
    <div
      className={cn(
        "game-shine relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[28px] bg-gradient-to-br p-5 shadow-xl",
        tier.card,
        tier.text,
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-center">
          <p className="text-5xl font-black leading-none">{card.ovr ?? "–"}</p>
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
            OVR
          </p>
          <p className="mt-2 text-xs font-bold">LV {level.level}</p>
        </div>
        <PersonAvatar
          person={person}
          size={92}
          className="border-4 border-white/40 bg-white/30 text-current"
        />
      </div>
      <p className="mt-3 truncate border-b border-current/20 pb-2 text-center text-xl font-black uppercase tracking-wide">
        {name || "Player"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {card.attributes.map((attribute) => (
          <div
            key={attribute.area}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate font-semibold opacity-90">
              {shortLabel(attribute)}
            </span>
            <span className="font-black tabular-nums">
              {attribute.score ?? "–"}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold opacity-90">TIER</span>
          <span className="font-black">{tier.label.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

function shortLabel(attribute: Attribute) {
  const labels: Record<string, string> = {
    SETUP: "SET",
    PUTTING: "PUT",
    SHORT_GAME: "SHO",
    LONG_GAME: "LNG",
    TACTICAL: "TAC",
    FITNESS: "FIT",
    MENTAL: "MEN",
  };
  return labels[attribute.area] ?? attribute.label;
}

/** Radar of the attributes with an optional comparison (last month …). */
export function SkillRadar({
  card,
  size = 280,
}: {
  card: PlayerCard;
  size?: number;
}) {
  const [compareKey, setCompareKey] = useState<string>("lastMonth");
  const compare =
    card.history.find((entry) => entry.key === compareKey) ?? null;
  const center = size / 2;
  const radius = size / 2 - 34;
  const count = card.attributes.length;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return [
      center + Math.cos(angle) * radius * (value / 100),
      center + Math.sin(angle) * radius * (value / 100),
    ];
  };
  const polygon = (values: (number | null)[]) =>
    values.map((value, index) => point(index, value ?? 0).join(",")).join(" ");
  const rated = card.attributes.some((attribute) => attribute.score !== null);
  const compareRated = compare?.attributes.some(
    (attribute) => attribute.score !== null,
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {card.history.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setCompareKey(entry.key)}
            className={cn(
              "min-h-9 rounded-full px-3 text-xs font-semibold",
              compareKey === entry.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600",
            )}
          >
            vs. {entry.label.toLowerCase()}
          </button>
        ))}
      </div>
      <svg
        viewBox={`-40 -6 ${size + 80} ${size + 12}`}
        className="mx-auto w-full max-w-[360px]"
        role="img"
        aria-label="Skill radar"
      >
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={polygon(card.attributes.map(() => ring))}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        {card.attributes.map((attribute, index) => {
          const [x, y] = point(index, 100);
          const [lx, ly] = point(index, 122);
          return (
            <g key={attribute.area}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="#e2e8f0" />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-500 text-[10px] font-semibold"
              >
                {focusMeta(attribute.area).label}
              </text>
            </g>
          );
        })}
        {compare && compareRated ? (
          <polygon
            points={polygon(compare.attributes.map((a) => a.score))}
            fill="rgba(148,163,184,0.15)"
            stroke="#94a3b8"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        ) : null}
        {rated ? (
          <polygon
            points={polygon(card.attributes.map((a) => a.score))}
            fill="rgba(16,185,129,0.25)"
            stroke="#059669"
            strokeWidth={2}
          />
        ) : null}
        {card.attributes.map((attribute, index) =>
          attribute.score !== null ? (
            <circle
              key={attribute.area}
              cx={point(index, attribute.score)[0]}
              cy={point(index, attribute.score)[1]}
              r={4}
              fill={focusMeta(attribute.area).color}
            />
          ) : null,
        )}
      </svg>
      {!rated ? (
        <p className="text-center text-sm text-slate-500">
          No ratings yet – complete missions and get coach reviews.
        </p>
      ) : null}
    </div>
  );
}

/** Attribute list with bars and the change against the comparison. */
export function AttributeList({
  card,
  compareKey = "lastMonth",
}: {
  card: PlayerCard;
  compareKey?: string;
}) {
  const compare = card.history.find((entry) => entry.key === compareKey);
  return (
    <ul className="space-y-3">
      {card.attributes.map((attribute) => {
        const meta = focusMeta(attribute.area);
        const before =
          compare?.attributes.find((a) => a.area === attribute.area)?.score ??
          null;
        const delta =
          attribute.score !== null && before !== null
            ? attribute.score - before
            : null;
        return (
          <li key={attribute.area}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-800">
                {meta.emoji} {meta.label}
              </span>
              <span className="flex items-center gap-2">
                {delta ? (
                  <span
                    className={cn(
                      "text-xs font-bold",
                      delta > 0 ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                  </span>
                ) : null}
                <span className="w-8 text-right font-black tabular-nums text-slate-900">
                  {attribute.score ?? "–"}
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${attribute.score ?? 0}%`,
                  background: meta.color,
                }}
              />
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {attribute.score === null
                ? "Not rated yet"
                : `${attribute.completed} mission${attribute.completed === 1 ? "" : "s"} · ${attribute.samples} rating${attribute.samples === 1 ? "" : "s"}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
