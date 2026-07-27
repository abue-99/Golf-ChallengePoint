"use client";

import { useEffect, useMemo, useState } from "react";
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

function toRadarPoints(scores: CapabilityScore[], radius: number, center: number) {
  return scores
    .map((capability, index) => {
      const angle = (-Math.PI / 2) + (FULL_CIRCLE_RADIANS * index) / scores.length;
      const r = (capability.score / 100) * radius;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function ringPoints(sides: number, radius: number, center: number) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (-Math.PI / 2) + (FULL_CIRCLE_RADIANS * index) / sides;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

// ─── Sub-Capability Panel ─────────────────────────────────────────────────────

function SubCapabilityPanel({
  capability,
  onClose,
}: {
  capability: CapabilityScore;
  onClose: () => void;
}) {
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {capability.label} — Sub-Skills
        </p>
        <button
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-600 px-1"
        >
          ✕
        </button>
      </div>
      {capability.subs.map((sub) => (
        <div key={sub.key} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <button
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
            onClick={() => setExpandedSub(expandedSub === sub.key ? null : sub.key)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-slate-400 flex-shrink-0 transition-transform",
                  expandedSub === sub.key && "rotate-90"
                )}
              />
              <span className="text-xs font-medium text-slate-700 truncate">{sub.label}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className="text-xs font-bold text-slate-700">{sub.score}</span>
              <span
                className="h-1.5 w-12 rounded-full overflow-hidden bg-slate-100"
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${sub.score}%`, background: capability.color }}
                />
              </span>
            </div>
          </button>
          {expandedSub === sub.key && sub.subSubs.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-2 space-y-1.5 bg-slate-50/70">
              {sub.subSubs.map((ss) => (
                <div key={ss.key} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 pl-3">{ss.label}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold text-slate-600">{ss.score}</span>
                    <span className="h-1 w-10 rounded-full overflow-hidden bg-slate-200">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${ss.score}%`, background: capability.color + "99" }}
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

// ─── Radar Card ───────────────────────────────────────────────────────────────

export function PlayerCapabilitiesRadarCard({
  playerId,
  title = "Capabilities Radar",
  onCapabilityClick,
}: {
  playerId: string;
  title?: string;
  onCapabilityClick?: (key: CapabilityKey) => void;
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setAnimate(true), 120);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const profile = useMemo(() => getPlayerCapabilityProfile(playerId), [playerId]);
  const { capabilities, overall } = profile;
  const size = 160;
  const center = size / 2;
  const radius = 55;

  return (
    <Card className="border border-[var(--golf-muted)] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto w-full max-w-[160px]">
          <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full">
            {[20, 40, 60, 80, 100].map((step) => (
              <polygon
                key={step}
                points={ringPoints(capabilities.length, radius * (step / 100), center)}
                fill="none"
                stroke="#d4d4d8"
                strokeWidth="1"
                opacity={0.5}
              />
            ))}

            {capabilities.map((capability, index) => {
              const angle = (-Math.PI / 2) + (FULL_CIRCLE_RADIANS * index) / capabilities.length;
              const x = center + Math.cos(angle) * radius;
              const y = center + Math.sin(angle) * radius;
              return (
                <g
                  key={capability.key}
                  style={{ cursor: onCapabilityClick ? "pointer" : "default" }}
                  onClick={() => onCapabilityClick?.(capability.key)}
                >
                  <line x1={center} y1={center} x2={x} y2={y} stroke="#d4d4d8" strokeWidth="1" opacity={0.65} />
                  <text
                    x={center + Math.cos(angle) * (radius + 12)}
                    y={center + Math.sin(angle) * (radius + 12)}
                    fontSize="7"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#334155"
                  >
                    {capability.label}
                  </text>
                </g>
              );
            })}

            <polygon
              points={toRadarPoints(capabilities, radius, center)}
              fill="#0891b2"
              fillOpacity="0.22"
              stroke="#0891b2"
              strokeWidth="1.5"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                transform: animate ? "scale(1)" : "scale(0.86)",
                transition: "transform 700ms ease",
              }}
            />
          </svg>

          <div className="-mt-[86px] flex h-[160px] items-center justify-center">
            <div className="rounded-full border border-cyan-200 bg-white/90 px-3 py-1.5 text-center shadow-sm backdrop-blur">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Overall</p>
              <p className="text-lg font-extrabold text-cyan-700">{overall} OVR</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Full Widget ──────────────────────────────────────────────────────────────

export function PlayerCapabilitiesWidget({ playerId }: { playerId: string }) {
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
    <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <Card className="border border-[var(--golf-muted)] shadow-sm min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl text-[var(--golf-heading)]">Player Capabilities</CardTitle>
            <p className="text-sm text-[var(--golf-muted-text)]">Animated skill profile from Developing to Elite</p>
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
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                        <Icon className="h-3.5 w-3.5 text-slate-700" />
                      </span>
                      <span className="text-sm font-medium text-slate-800">{capability.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-600">{capability.score}</p>
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

                  <div className="h-2 rounded-full bg-slate-100">
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
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Archetype</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Trophy className="h-4 w-4 text-amber-500" />
                {profile.archetype}
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3 sm:col-span-2">
              <p className="text-xs text-slate-500">Skill Tree / Level-Up</p>
              <div className="mt-1 flex items-center justify-between text-sm font-semibold text-slate-800">
                <span className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-cyan-600" />
                  Level {profile.level}
                </span>
                <span>{profile.levelProgress}% to next level</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-700"
                  style={{ width: animate ? `${profile.levelProgress}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PlayerCapabilitiesRadarCard
        playerId={playerId}
        title="Spider Overview"
        onCapabilityClick={toggleCapability}
      />
    </section>
  );
}
