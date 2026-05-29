export type CapabilityKey =
  | "setup"
  | "putting"
  | "shortGame"
  | "longGame"
  | "tactics"
  | "fitness"
  | "mental";

export type SkillRating = "Developing" | "Intermediate" | "Advanced" | "Proficient" | "Elite";

export type CapabilityDefinition = {
  key: CapabilityKey;
  label: string;
  base: number;
  color: string;
};

export type CapabilityScore = CapabilityDefinition & {
  score: number;
  rating: SkillRating;
};

export type PlayerCapabilityProfile = {
  capabilities: CapabilityScore[];
  overall: number;
  level: number;
  levelProgress: number;
  archetype: string;
};

export const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  { key: "setup", label: "Setup", base: 67, color: "#22c55e" },
  { key: "putting", label: "Putting", base: 80, color: "#8b5cf6" },
  { key: "shortGame", label: "Short Game", base: 56, color: "#06b6d4" },
  { key: "longGame", label: "Long Game", base: 72, color: "#f59e0b" },
  { key: "tactics", label: "Tactics", base: 64, color: "#ef4444" },
  { key: "fitness", label: "Fitness", base: 51, color: "#f97316" },
  { key: "mental", label: "Mental", base: 59, color: "#3b82f6" },
];

const HASH_RANGE = 1000;
const MIN_BASE_MULTIPLIER = 0.65;
const VARIANCE_RANGE = 48;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashToUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % HASH_RANGE) / HASH_RANGE;
}

export function scoreToRating(score: number): SkillRating {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Proficient";
  if (score >= 60) return "Advanced";
  if (score >= 40) return "Intermediate";
  return "Developing";
}

function resolveArchetype(capabilities: CapabilityScore[]): string {
  const scoreMap = Object.fromEntries(capabilities.map((c) => [c.key, c.score])) as Record<CapabilityKey, number>;

  if (scoreMap.longGame + scoreMap.fitness >= 160) return "Power Hitter";
  if (scoreMap.putting + scoreMap.shortGame >= 155) return "Precision Player";
  if (scoreMap.tactics + scoreMap.mental >= 150) return "Course Strategist";
  if (scoreMap.setup + scoreMap.mental >= 145) return "Consistency Specialist";

  return "All-Round Competitor";
}

export function getPlayerCapabilityProfile(playerId: string): PlayerCapabilityProfile {
  const idSeed = playerId || "default-player";

  const capabilities = CAPABILITY_DEFINITIONS.map((definition, index) => {
    const roll = hashToUnit(`${idSeed}:${definition.key}:${index}`);
    const score = clamp(
      Math.round(definition.base * MIN_BASE_MULTIPLIER + roll * VARIANCE_RANGE),
      1,
      100,
    );

    return {
      ...definition,
      score,
      rating: scoreToRating(score),
    };
  });

  const total = capabilities.reduce((sum, capability) => sum + capability.score, 0);
  const overall = Math.round(total / capabilities.length);
  const level = clamp(Math.floor(overall / 10), 1, 10);
  const levelProgress = clamp((overall % 10) * 10, 0, 100);

  return {
    capabilities,
    overall,
    level,
    levelProgress,
    archetype: resolveArchetype(capabilities),
  };
}
