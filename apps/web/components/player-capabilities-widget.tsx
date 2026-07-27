"use client";

import { useEffect, useMemo, useState } from "react";
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
const SEGMENT_GAP_RADIANS = 0.12;

function polarToCartesian(radius: number, angle: number, center: number) {
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function arcPath(radius: number, startAngle: number, endAngle: number, center: number) {
  const start = polarToCartesian(radius, startAngle, center);
  const end = polarToCartesian(radius, endAngle, center);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function scoreQualityColor(score: number) {
  if (score >= 90) return "#fbbf24";
  if (score >= 75) return "#22c55e";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function CircularSkillWheel({
  capabilities,
  overall,
  level,
  levelProgress,
  selectedCapability,
  onSegmentClick,
}: {
  capabilities: CapabilityScore[];
  overall: number;
  level: number;
  levelProgress: number;
  selectedCapability?: CapabilityKey | null;
  onSegmentClick?: (key: CapabilityKey) => void;
}) {
  const [animatedScores, setAnimatedScores] = useState<number[]>(() => capabilities.map(() => 0));

  useEffect(() => {
    const start = performance.now();
    const duration = 950;
    let raf = 0;

    const fromScores = animatedScores.length === capabilities.length
      ? animatedScores
      : capabilities.map(() => 0);

    const tick = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScores(
        capabilities.map((capability, index) => {
          const from = fromScores[index] ?? 0;
          return Math.round(from + (capability.score - from) * eased);
        })
      );
      if (progress < 1) raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [capabilities]);

  const size = 340;
  const center = size / 2;
  const radius = 118;
  const strokeWidth = 34;
  const segmentSweep = FULL_CIRCLE_RADIANS / capabilities.length;

  return (
    <div className="mx-auto w-full max-w-[380px] aspect-square">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        {capabilities.map((capability, index) => {
          const startAngle = -Math.PI / 2 + index * segmentSweep + SEGMENT_GAP_RADIANS / 2;
          const endAngle = startAngle + segmentSweep - SEGMENT_GAP_RADIANS;
          const arc = arcPath(radius, startAngle, endAngle, center);
          const arcLength = Math.max((endAngle - startAngle) * radius, 1);
          const filledLength = arcLength * ((animatedScores[index] ?? 0) / 100);

          const labelAnchor = polarToCartesian(radius + 34, startAngle + (endAngle - startAngle) / 2, center);
          const isSelected = selectedCapability === capability.key;

          return (
            <g key={capability.key}>
              <path
                d={arc}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                className="text-slate-200 dark:text-slate-700"
              />
              <path
                d={arc}
                stroke={isSelected ? scoreQualityColor(capability.score) : capability.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${filledLength} ${Math.max(arcLength - filledLength, 0.001)}`}
                style={{ transition: "stroke-dasharray 950ms cubic-bezier(0.22, 1, 0.36, 1), stroke 250ms ease" }}
              />
              <g
                style={{ cursor: onSegmentClick ? "pointer" : "default" }}
                onClick={() => onSegmentClick?.(capability.key)}
              >
                <text
                  x={labelAnchor.x}
                  y={labelAnchor.y}
                  fontSize="11"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="currentColor"
                  className="text-slate-700 dark:text-slate-200"
                >
                  {capability.label}
                </text>
              </g>
            </g>
          );
        })}

        <circle cx={center} cy={center} r="66" className="fill-white dark:fill-slate-900" />
        <circle cx={center} cy={center} r="66" className="stroke-slate-200 dark:stroke-slate-700" fill="none" />

        <text x={center} y={center - 12} textAnchor="middle" className="fill-slate-900 dark:fill-slate-100" style={{ fontSize: 34, fontWeight: 800 }}>
          {overall}
        </text>
        <text x={center} y={center + 11} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2 }}>
          OVR
        </text>
        <text x={center} y={center + 30} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: 11, fontWeight: 600 }}>
          Level {level} · {levelProgress}%
        </text>
      </svg>
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

// ─── Circular Skill Wheel Card ─────────────────────────────────────────────────

export function PlayerCapabilitiesRadarCard({
  playerId,
  title = "Capability Wheel",
  onCapabilityClick,
}: {
  playerId: string;
  title?: string;
  onCapabilityClick?: (key: CapabilityKey) => void;
}) {
  const profile = useMemo(() => getPlayerCapabilityProfile(playerId), [playerId]);
  const [selectedCapability, setSelectedCapability] = useState<CapabilityKey | null>(null);

  const selected = selectedCapability
    ? profile.capabilities.find((capability) => capability.key === selectedCapability) ?? null
    : null;

  function handleCapabilityClick(key: CapabilityKey) {
    setSelectedCapability((prev) => (prev === key ? null : key));
    onCapabilityClick?.(key);
  }

  return (
    <Card className="border border-[var(--golf-muted)] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <CircularSkillWheel
          capabilities={profile.capabilities}
          overall={profile.overall}
          level={profile.level}
          levelProgress={profile.levelProgress}
          selectedCapability={selectedCapability}
          onSegmentClick={handleCapabilityClick}
        />

        {selected && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-100">
                {selected.label}
              </p>
              <span className="text-lg font-extrabold" style={{ color: selected.color }}>
                {selected.score}
              </span>
            </div>
            <div className="space-y-1.5">
              {selected.subs.slice(0, 5).map((sub) => (
                <div key={sub.key} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">{sub.label}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-100">{sub.score}</span>
                </div>
              ))}
            </div>
            <Link
              href="/player"
              className="mt-3 inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-500"
            >
              View Journey
            </Link>
          </div>
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
          title="Capability Wheel"
          onCapabilityClick={toggleCapability}
        />
      )}
    </section>
  );
}
