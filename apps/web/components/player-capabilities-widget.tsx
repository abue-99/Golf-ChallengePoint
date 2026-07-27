"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Brain,
  CircleDot,
  Dumbbell,
  Gauge,
  Rocket,
  Settings2,
  Swords,
  Trophy,
  Zap,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CapabilityKey, CapabilityScore, getPlayerCapabilityProfile } from "@/lib/player-capabilities";

const iconByCapability: Record<CapabilityKey, LucideIcon> = {
  setup: Settings2,
  putting: CircleDot,
  shortGame: Swords,
  longGame: Rocket,
  tactics: Brain,
  fitness: Dumbbell,
  mental: Zap,
};

const ratingTone: Record<CapabilityScore["rating"], string> = {
  Developing: "text-orange-600",
  Intermediate: "text-amber-600",
  Advanced: "text-cyan-600",
  Proficient: "text-violet-600",
  Elite: "text-emerald-600",
};

const FULL_CIRCLE_RADIANS = Math.PI * 2;
const DELTA_POPUP_DURATION_MS = 1500;

function polarToCartesian(radius: number, angle: number, center: number) {
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreQualityColor(score: number) {
  if (score >= 90) return "#fbbf24";
  if (score >= 75) return "#22c55e";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function syntheticHistoricalOffsetByIndex(index: number) {
  // Stable synthetic wobble so mocked historical overlays are not perfectly linear.
  const pattern = [-2, 0, 2];
  return pattern[index % pattern.length];
}

function findCapabilityByScore(
  capabilities: CapabilityScore[],
  mode: "min" | "max",
): CapabilityScore | null {
  if (capabilities.length === 0) return null;
  let selected = capabilities[0];
  for (let i = 1; i < capabilities.length; i += 1) {
    const capability = capabilities[i];
    const shouldReplace = mode === "min"
      ? capability.score < selected.score
      : capability.score > selected.score;
    if (shouldReplace) selected = capability;
  }
  return selected;
}

const COMPARISON_PRESETS = [
  { key: "current", label: "Current", decay: 0 },
  { key: "lastMonth", label: "Last Month", decay: 4 },
  { key: "lastQuarter", label: "Last Quarter", decay: 7 },
  { key: "lastYear", label: "Last Year", decay: 12 },
] as const;

type ComparisonPresetKey = (typeof COMPARISON_PRESETS)[number]["key"];

type DeltaPopup = {
  key: CapabilityKey;
  delta: number;
};

const LESSONS_BY_CAPABILITY: Record<CapabilityKey, string[]> = {
  // Placeholder lesson mapping until API-backed lesson-impact links are available.
  setup: ["Address Check", "Pre-Shot Routine", "Alignment Gate"],
  putting: ["Gate Drill", "Distance Control", "Pressure Putting"],
  shortGame: ["Bunker Escapes", "One-Hop Pitch", "Up & Down Ladder"],
  longGame: ["Fairway Finder", "Driver Tempo", "Launch Window"],
  tactics: ["Course Strategy", "Risk Matrix", "Pin Position Planning"],
  fitness: ["Mobility Circuit", "Core Stability", "Rotational Strength"],
  mental: ["Reset Breath", "Pressure Rehearsal", "Focus Ladder"],
};

function buildComparisonScores(capabilities: CapabilityScore[], preset: ComparisonPresetKey) {
  // We currently do not persist time-series capability history, so these overlays
  // intentionally simulate prior snapshots using: score - decay + synthetic offset.
  const decay = COMPARISON_PRESETS.find((item) => item.key === preset)?.decay ?? 0;
  if (decay === 0) return capabilities.map((capability) => capability.score);

  return capabilities.map((capability, index) => {
    const drift = syntheticHistoricalOffsetByIndex(index);
    return clamp(capability.score - decay + drift, 1, 100);
  });
}

function buildPolygonPoints({
  scores,
  center,
  maxRadius,
  segmentSweep,
}: {
  scores: number[];
  center: number;
  maxRadius: number;
  segmentSweep: number;
}) {
  return scores
    .map((score, index) => {
      const angle = -Math.PI / 2 + index * segmentSweep;
      const radius = (score / 100) * maxRadius;
      const { x, y } = polarToCartesian(radius, angle, center);
      return `${x},${y}`;
    })
    .join(" ");
}

function segmentPath({
  index,
  segmentSweep,
  radius,
  center,
}: {
  index: number;
  segmentSweep: number;
  radius: number;
  center: number;
}) {
  const startAngle = -Math.PI / 2 + index * segmentSweep - segmentSweep / 2;
  const endAngle = startAngle + segmentSweep;
  const start = polarToCartesian(radius, startAngle, center);
  const end = polarToCartesian(radius, endAngle, center);
  return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y} Z`;
}

function SkillRadar2Chart({
  capabilities,
  overall,
  level,
  selectedCapability,
  hoverCapability,
  comparisonScores,
  onNodeTap,
  onNodeHover,
  deltaPopups,
}: {
  capabilities: CapabilityScore[];
  overall: number;
  level: number;
  selectedCapability: CapabilityKey | null;
  hoverCapability: CapabilityKey | null;
  comparisonScores: number[];
  onNodeTap: (key: CapabilityKey) => void;
  onNodeHover: (key: CapabilityKey | null) => void;
  deltaPopups: DeltaPopup[];
}) {
  const [animatedScores, setAnimatedScores] = useState<number[]>(() => capabilities.map(() => 0));
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const previousScoresRef = useRef<number[]>(capabilities.map(() => 0));
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const duration = prefersReducedMotion ? 0 : 1000;
    let raf = 0;

    const fromScores = previousScoresRef.current.length === capabilities.length
      ? previousScoresRef.current
      : capabilities.map(() => 0);

    const tick = (timestamp: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (timestamp - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextScores = capabilities.map((capability, index) => {
        const from = fromScores[index] ?? 0;
        return from + (capability.score - from) * eased;
      });

      setAnimatedScores(nextScores);

      if (progress < 1) {
        raf = window.requestAnimationFrame(tick);
      } else {
        previousScoresRef.current = capabilities.map((capability) => capability.score);
      }
    };

    if (duration === 0) {
      setAnimatedScores(capabilities.map((capability) => capability.score));
      previousScoresRef.current = capabilities.map((capability) => capability.score);
      return;
    }

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [capabilities, prefersReducedMotion]);

  const size = 420;
  const center = size / 2;
  const maxRadius = 150;
  const labelRadius = 184;
  const segmentSweep = FULL_CIRCLE_RADIANS / capabilities.length;
  const activeCapability = selectedCapability ?? hoverCapability;

  const currentPoints = buildPolygonPoints({
    scores: animatedScores,
    center,
    maxRadius,
    segmentSweep,
  });

  const comparisonPoints = buildPolygonPoints({
    scores: comparisonScores,
    center,
    maxRadius,
    segmentSweep,
  });

  const weakestCapabilityLabel = useMemo(() => {
    const weakest = findCapabilityByScore(capabilities, "min");
    return weakest?.label ?? "Skill";
  }, [capabilities]);

  return (
    <div className="mx-auto w-full max-w-[460px] aspect-square">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>Skill Radar 2.0</title>
        <desc id={descId}>Overall score {overall}, level {level}, current goal Improve {weakestCapabilityLabel}.</desc>
        {[20, 40, 60, 80, 100].map((ring) => {
          const ringPoints = buildPolygonPoints({
            scores: capabilities.map(() => ring),
            center,
            maxRadius,
            segmentSweep,
          });
          return (
            <polygon
              key={ring}
              points={ringPoints}
              fill="none"
              stroke="currentColor"
              strokeWidth={ring === 100 ? 1.5 : 1}
              className="text-slate-200/90 dark:text-slate-700/80"
            />
          );
        })}

        {capabilities.map((capability, index) => {
          const angle = -Math.PI / 2 + index * segmentSweep;
          const outerPoint = polarToCartesian(maxRadius, angle, center);
          const labelPoint = polarToCartesian(labelRadius, angle, center);
          const isActive = activeCapability === capability.key;
          const isMuted = !!activeCapability && !isActive;
          const liveScore = animatedScores[index] ?? 0;
          const nodePoint = polarToCartesian((liveScore / 100) * maxRadius, angle, center);
          const deltaPopup = deltaPopups.find((popup) => popup.key === capability.key);

          return (
            <g key={capability.key}>
              <line
                x1={center}
                y1={center}
                x2={outerPoint.x}
                y2={outerPoint.y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-slate-200 dark:text-slate-700"
              />

              <path
                d={segmentPath({ index, segmentSweep, radius: maxRadius + 24, center })}
                fill={isActive ? "rgba(59,130,246,0.12)" : "transparent"}
                style={{ transition: "fill 220ms ease" }}
              />

              <g
                style={{ opacity: isMuted ? 0.35 : 1, transition: "opacity 200ms ease" }}
                onMouseEnter={() => onNodeHover(capability.key)}
                onMouseLeave={() => onNodeHover(null)}
              >
                <circle
                  cx={nodePoint.x}
                  cy={nodePoint.y}
                  r={isActive ? 12 : 10}
                  fill={scoreQualityColor(capability.score)}
                  stroke="white"
                  strokeWidth={isActive ? 3 : 2}
                />

                {deltaPopup && (
                  <>
                    <circle
                      cx={nodePoint.x}
                      cy={nodePoint.y}
                      r={16}
                      fill="none"
                      stroke={scoreQualityColor(capability.score)}
                      strokeWidth={2}
                      className={prefersReducedMotion ? undefined : "animate-ping"}
                    />
                    <text
                      x={nodePoint.x}
                      y={nodePoint.y - 22}
                      textAnchor="middle"
                      className="fill-emerald-500"
                      style={{ fontSize: 12, fontWeight: 800 }}
                    >
                      +{deltaPopup.delta}
                    </text>
                  </>
                )}

                <circle
                  cx={nodePoint.x}
                  cy={nodePoint.y}
                  r={22}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${capability.label} score ${Math.round(liveScore)}`}
                  onClick={() => onNodeTap(capability.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onNodeTap(capability.key);
                    }
                  }}
                />

                <text
                  x={labelPoint.x}
                  y={labelPoint.y - 8}
                  textAnchor="middle"
                  className="fill-slate-800 dark:fill-slate-100"
                  style={{ fontSize: 12, fontWeight: 700 }}
                >
                  {capability.label}
                </text>
                <text
                  x={labelPoint.x}
                  y={labelPoint.y + 9}
                  textAnchor="middle"
                  style={{ fontSize: 12, fontWeight: 800 }}
                  fill={scoreQualityColor(capability.score)}
                >
                  {Math.round(liveScore)}
                </text>
              </g>
            </g>
          );
        })}

        <polygon
          points={comparisonPoints}
          fill="rgba(148,163,184,0.12)"
          stroke="rgba(148,163,184,0.9)"
          strokeWidth={2}
          strokeDasharray="5 5"
        />

        <polygon
          points={currentPoints}
          fill="rgba(59,130,246,0.28)"
          stroke="rgba(37,99,235,0.95)"
          strokeWidth={3}
        />

        <circle cx={center} cy={center} r="58" className="fill-white dark:fill-slate-900" />
        <circle cx={center} cy={center} r="58" className="stroke-slate-200 dark:stroke-slate-700" fill="none" />

        <text
          x={center}
          y={center - 10}
          textAnchor="middle"
          className="fill-slate-900 dark:fill-slate-100"
          style={{ fontSize: 36, fontWeight: 900 }}
        >
          {overall}
        </text>
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400"
          style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}
        >
          OVR
        </text>
        <text
          x={center}
          y={center + 32}
          textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400"
          style={{ fontSize: 11, fontWeight: 600 }}
        >
          Level {level}
        </text>
        <text
          x={center}
          y={center + 46}
          textAnchor="middle"
          className="fill-slate-400 dark:fill-slate-500"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          Goal: Improve {weakestCapabilityLabel}
        </text>
      </svg>
    </div>
  );
}

function CapabilityDetailPanel({
  capability,
  trend,
  onClose,
}: {
  capability: CapabilityScore;
  trend: number;
  onClose: () => void;
}) {
  const lessons = LESSONS_BY_CAPABILITY[capability.key] ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40 animate-in slide-in-from-bottom-3 duration-300 md:slide-in-from-right-2">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">{capability.label}</p>
          <p className="text-2xl font-black" style={{ color: scoreQualityColor(capability.score) }}>{capability.score}</p>
          <p className={cn("text-xs font-semibold", trend >= 0 ? "text-emerald-600" : "text-red-500")}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)} Last 30 Days
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Close
        </button>
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Sub-Capabilities</p>
        {/* Show top five for compact readability on mobile and side panel layouts. */}
        {capability.subs.slice(0, 5).map((sub) => (
          <div key={sub.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200">{sub.label}</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{sub.score}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full"
                style={{ width: `${sub.score}%`, background: scoreQualityColor(sub.score) }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Impacting Lessons</p>
        <ul className="mt-1 space-y-1">
          {lessons.map((lesson) => (
            <li key={lesson} className="text-xs text-slate-700 dark:text-slate-200">• {lesson}</li>
          ))}
        </ul>
      </div>

      <Link
        href="/player"
        className="mt-3 inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-500"
      >
        View Journey
      </Link>
    </div>
  );
}

// ─── Sub-Capability Panel ─────────────────────────────────────────────────────

const SUB_SUB_CAPABILITY_ALPHA = "99";

function SubCapabilityPanel({
  capability,
  onClose,
}: {
  capability: CapabilityScore;
  onClose: () => void;
}) {
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide dark:text-slate-300">
          {capability.label} — Sub-Skills
        </p>
        <button
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-600 px-1 dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>
      {capability.subs.map((sub) => (
        <div key={sub.key} className="rounded-lg border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
          <button
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
            onClick={() => setExpandedSub(expandedSub === sub.key ? null : sub.key)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-slate-400 flex-shrink-0 transition-transform",
                  expandedSub === sub.key && "rotate-90"
                )}
              />
              <span className="text-xs font-medium text-slate-700 truncate dark:text-slate-200">{sub.label}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-100">{sub.score}</span>
              <span
                className="h-1.5 w-12 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700"
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${sub.score}%`, background: capability.color }}
                />
              </span>
            </div>
          </button>
          {expandedSub === sub.key && sub.subSubs.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-2 space-y-1.5 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50">
              {sub.subSubs.map((ss) => (
                <div key={ss.key} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 pl-3 dark:text-slate-300">{ss.label}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{ss.score}</span>
                    <span className="h-1 w-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-600">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${ss.score}%`, background: capability.color + SUB_SUB_CAPABILITY_ALPHA }}
                      />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Skill Radar 2.0 Card ──────────────────────────────────────────────────────

export function PlayerCapabilitiesRadarCard({
  playerId,
  title = "Skill Radar 2.0",
  onCapabilityClick,
}: {
  playerId: string;
  title?: string;
  onCapabilityClick?: (key: CapabilityKey) => void;
}) {
  const profile = useMemo(() => getPlayerCapabilityProfile(playerId), [playerId]);
  const [selectedCapability, setSelectedCapability] = useState<CapabilityKey | null>(null);
  const [hoverCapability, setHoverCapability] = useState<CapabilityKey | null>(null);
  const [comparisonPreset, setComparisonPreset] = useState<ComparisonPresetKey>("lastMonth");
  const [deltaPopups, setDeltaPopups] = useState<DeltaPopup[]>([]);
  const previousLiveScoresRef = useRef<number[]>(profile.capabilities.map((capability) => capability.score));
  const hasInitializedDeltaRef = useRef(false);

  const comparisonScores = useMemo(
    () => buildComparisonScores(profile.capabilities, comparisonPreset),
    [profile.capabilities, comparisonPreset],
  );

  const monthScores = useMemo(
    () => buildComparisonScores(profile.capabilities, "lastMonth"),
    [profile.capabilities],
  );

  const strongestCapability = useMemo(
    () => findCapabilityByScore(profile.capabilities, "max"),
    [profile.capabilities],
  );

  const weakestCapability = useMemo(
    () => findCapabilityByScore(profile.capabilities, "min"),
    [profile.capabilities],
  );

  const selected = selectedCapability
    ? profile.capabilities.find((capability) => capability.key === selectedCapability) ?? null
    : null;

  const monthlyScoreByCapability = useMemo(
    () => Object.fromEntries(profile.capabilities.map((capability, index) => [capability.key, monthScores[index] ?? capability.score])),
    [monthScores, profile.capabilities],
  );

  const selectedTrend = selected ? selected.score - (monthlyScoreByCapability[selected.key] ?? selected.score) : 0;

  useEffect(() => {
    if (!hasInitializedDeltaRef.current) {
      hasInitializedDeltaRef.current = true;
      previousLiveScoresRef.current = profile.capabilities.map((capability) => capability.score);
      return;
    }

    const previousScores = previousLiveScoresRef.current;
    const nextPopups = profile.capabilities
      .map((capability, index) => {
        const delta = capability.score - (previousScores[index] ?? 0);
        return delta > 0 ? { key: capability.key, delta } : null;
      })
      .filter((item): item is DeltaPopup => item !== null);

    setDeltaPopups(nextPopups);
    const timeoutId = window.setTimeout(() => setDeltaPopups([]), DELTA_POPUP_DURATION_MS);
    previousLiveScoresRef.current = profile.capabilities.map((capability) => capability.score);

    return () => window.clearTimeout(timeoutId);
  }, [profile.capabilities]);

  function handleCapabilityClick(key: CapabilityKey) {
    setSelectedCapability((prev) => (prev === key ? null : key));
    onCapabilityClick?.(key);
  }

  return (
    <Card className="border border-[var(--golf-muted)] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-3", selected && "md:grid md:grid-cols-[minmax(0,1fr)_280px] md:gap-3 md:space-y-0")}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {COMPARISON_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => setComparisonPreset(preset.key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  comparisonPreset === preset.key
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <SkillRadar2Chart
            capabilities={profile.capabilities}
            overall={profile.overall}
            level={profile.level}
            selectedCapability={selectedCapability}
            hoverCapability={hoverCapability}
            comparisonScores={comparisonScores}
            onNodeTap={handleCapabilityClick}
            onNodeHover={setHoverCapability}
            deltaPopups={deltaPopups}
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Player Development | Skill Radar 2.0</p>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{profile.overall} OVR</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">Top Strength</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{strongestCapability?.label ?? "N/A"}</p>
                <p className="text-sm font-black" style={{ color: strongestCapability ? scoreQualityColor(strongestCapability.score) : "#64748b" }}>
                  {strongestCapability?.score ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">Needs Focus</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{weakestCapability?.label ?? "N/A"}</p>
                <p className="text-sm font-black" style={{ color: weakestCapability ? scoreQualityColor(weakestCapability.score) : "#64748b" }}>
                  {weakestCapability?.score ?? "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <CapabilityDetailPanel
            capability={selected}
            trend={selectedTrend}
            onClose={() => setSelectedCapability(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Full Widget ──────────────────────────────────────────────────────────────

export function PlayerCapabilitiesWidget({
  playerId,
  showRadar = true,
}: {
  playerId: string;
  showRadar?: boolean;
}) {
  const [animate, setAnimate] = useState(false);
  const [expandedCapability, setExpandedCapability] = useState<CapabilityKey | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setAnimate(true), 120);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const profile = useMemo(() => getPlayerCapabilityProfile(playerId), [playerId]);

  function toggleCapability(key: CapabilityKey) {
    setExpandedCapability((prev) => (prev === key ? null : key));
  }

  return (
    <section className={cn(showRadar ? "grid gap-4 lg:grid-cols-[1fr_auto]" : "w-full")}> 
      <Card className="border border-[var(--golf-muted)] shadow-sm min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl text-[var(--golf-heading)]">Player Capabilities</CardTitle>
            <p className="text-sm text-[var(--golf-muted-text)]">Interactive breakdown from Developing to Elite</p>
          </div>
          <Badge className="rounded-full bg-[var(--golf-primary)] px-3 py-1 text-xs tracking-wide text-white">
            {profile.overall} OVR
          </Badge>
        </CardHeader>

        <CardContent className="space-y-3">
          {profile.capabilities.map((capability) => {
            const Icon = iconByCapability[capability.key];
            const isExpanded = expandedCapability === capability.key;
            return (
              <div key={capability.key}>
                <button
                  className="w-full text-left space-y-1.5"
                  onClick={() => toggleCapability(capability.key)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                        <Icon className="h-3.5 w-3.5 text-slate-700 dark:text-slate-200" />
                      </span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{capability.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{capability.score}</p>
                        <p className={cn("text-xs font-semibold uppercase tracking-wide", ratingTone[capability.rating])}>
                          {capability.rating}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: animate ? `${capability.score}%` : "0%",
                        background: `linear-gradient(90deg, ${capability.color}, ${capability.color}CC)`,
                        transition: "width 700ms ease",
                      }}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <SubCapabilityPanel
                    capability={capability}
                    onClose={() => setExpandedCapability(null)}
                  />
                )}
              </div>
            );
          })}

          <div className="grid gap-3 border-t pt-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-xs text-slate-500 dark:text-slate-300">Archetype</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Trophy className="h-4 w-4 text-amber-500" />
                {profile.archetype}
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-xs text-slate-500 dark:text-slate-300">Skill Tree / Level-Up</p>
              <div className="mt-1 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100">
                <span className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-cyan-600" />
                  Level {profile.level}
                </span>
                <span>{profile.levelProgress}% to next level</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-700"
                  style={{ width: animate ? `${profile.levelProgress}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showRadar && (
        <PlayerCapabilitiesRadarCard
          playerId={playerId}
          title="Skill Radar 2.0"
          onCapabilityClick={toggleCapability}
        />
      )}
    </section>
  );
}
