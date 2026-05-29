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

function toRadarPoints(scores: CapabilityScore[], radius: number, center: number) {
  return scores
    .map((capability, index) => {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / scores.length;
      const r = (capability.score / 100) * radius;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function ringPoints(sides: number, radius: number, center: number) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / sides;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function PlayerCapabilitiesRadarCard({ playerId, title = "Capabilities Radar" }: { playerId: string; title?: string }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setAnimate(true), 120);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const profile = useMemo(() => getPlayerCapabilityProfile(playerId), [playerId]);
  const { capabilities, overall } = profile;
  const size = 250;
  const center = size / 2;
  const radius = 88;

  return (
    <Card className="border border-[var(--golf-muted)] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto w-full max-w-[250px]">
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
              const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / capabilities.length;
              const x = center + Math.cos(angle) * radius;
              const y = center + Math.sin(angle) * radius;
              return (
                <g key={capability.key}>
                  <line x1={center} y1={center} x2={x} y2={y} stroke="#d4d4d8" strokeWidth="1" opacity={0.65} />
                  <text
                    x={center + Math.cos(angle) * (radius + 18)}
                    y={center + Math.sin(angle) * (radius + 18)}
                    fontSize="10"
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
              strokeWidth="2"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                transform: animate ? "scale(1)" : "scale(0.86)",
                transition: "transform 700ms ease",
              }}
            />
          </svg>

          <div className="-mt-[138px] flex h-[250px] items-center justify-center">
            <div className="rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-center shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall</p>
              <p className="text-2xl font-extrabold text-cyan-700">{overall} OVR</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlayerCapabilitiesWidget({ playerId }: { playerId: string }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setAnimate(true), 120);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const profile = useMemo(() => getPlayerCapabilityProfile(playerId), [playerId]);

  return (
    <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Card className="border border-[var(--golf-muted)] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl text-[var(--golf-heading)]">Player Capabilities</CardTitle>
            <p className="text-sm text-[var(--golf-muted-text)]">Animated skill profile from Developing to Elite</p>
          </div>
          <Badge className="rounded-full bg-[var(--golf-primary)] px-3 py-1 text-xs tracking-wide text-white">
            {profile.overall} OVR
          </Badge>
        </CardHeader>

        <CardContent className="space-y-5">
          {profile.capabilities.map((capability) => {
            const Icon = iconByCapability[capability.key];
            return (
              <div key={capability.key} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                      <Icon className="h-4 w-4 text-slate-700" />
                    </span>
                    <span className="text-sm font-medium text-slate-800">{capability.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-600">{capability.score}</p>
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", ratingTone[capability.rating])}>
                      {capability.rating}
                    </p>
                  </div>
                </div>

                <div className="h-2.5 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: animate ? `${capability.score}%` : "0%",
                      background: `linear-gradient(90deg, ${capability.color}, ${capability.color}CC)`,
                      transition: "width 700ms ease",
                    }}
                  />
                </div>
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

      <PlayerCapabilitiesRadarCard playerId={playerId} title="Spider Overview" />
    </section>
  );
}
