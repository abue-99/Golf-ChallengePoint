export type CapabilityKey =
  | "setup"
  | "putting"
  | "shortGame"
  | "longGame"
  | "tactics"
  | "fitness"
  | "mental";

export type SkillRating = "Developing" | "Intermediate" | "Advanced" | "Proficient" | "Elite";

export type SubSubCapabilityDefinition = {
  key: string;
  label: string;
  base: number;
};

export type SubCapabilityDefinition = {
  key: string;
  label: string;
  base: number;
  subSubs: SubSubCapabilityDefinition[];
};

export type CapabilityDefinition = {
  key: CapabilityKey;
  label: string;
  base: number;
  color: string;
  subs: SubCapabilityDefinition[];
};

export type SubSubCapabilityScore = SubSubCapabilityDefinition & {
  score: number;
  rating: SkillRating;
};

export type SubCapabilityScore = Omit<SubCapabilityDefinition, "subSubs"> & {
  score: number;
  rating: SkillRating;
  subSubs: SubSubCapabilityScore[];
};

export type CapabilityScore = Omit<CapabilityDefinition, "subs"> & {
  score: number;
  rating: SkillRating;
  subs: SubCapabilityScore[];
};

export type PlayerCapabilityProfile = {
  capabilities: CapabilityScore[];
  overall: number;
  level: number;
  levelProgress: number;
  archetype: string;
};

export const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    key: "setup",
    label: "Setup",
    base: 67,
    color: "#22c55e",
    subs: [
      {
        key: "grip", label: "Grip", base: 68,
        subSubs: [
          { key: "gripFundamentals", label: "Grip Fundamentals", base: 70 },
          { key: "gripPressure", label: "Grip Pressure", base: 65 },
          { key: "gripConsistency", label: "Grip Consistency", base: 68 },
        ],
      },
      {
        key: "alignment", label: "Alignment", base: 66,
        subSubs: [
          { key: "feetAlignment", label: "Feet Alignment", base: 67 },
          { key: "shoulderAlignment", label: "Shoulder Alignment", base: 64 },
          { key: "clubfaceAlignment", label: "Clubface Alignment", base: 65 },
        ],
      },
      {
        key: "ballPosition", label: "Ball Position", base: 65,
        subSubs: [
          { key: "driverSetup", label: "Driver Setup", base: 66 },
          { key: "ironSetup", label: "Iron Setup", base: 65 },
          { key: "shortGameSetup", label: "Short Game Setup", base: 63 },
        ],
      },
      {
        key: "posture", label: "Posture", base: 70,
        subSubs: [
          { key: "spineAngle", label: "Spine Angle", base: 71 },
          { key: "kneeFlex", label: "Knee Flex", base: 69 },
          { key: "athleticPosition", label: "Athletic Position", base: 70 },
        ],
      },
      {
        key: "weightDistribution", label: "Weight Distribution", base: 64,
        subSubs: [
          { key: "balanceAtAddress", label: "Balance at Address", base: 65 },
          { key: "weightControl", label: "Weight Control", base: 63 },
        ],
      },
      {
        key: "preShotRoutine", label: "Pre-Shot Routine", base: 60,
        subSubs: [
          { key: "routineConsistency", label: "Routine Consistency", base: 61 },
          { key: "preparationDiscipline", label: "Preparation Discipline", base: 59 },
        ],
      },
    ],
  },
  {
    key: "putting",
    label: "Putting",
    base: 80,
    color: "#8b5cf6",
    subs: [
      {
        key: "shortPutting", label: "Short Range (0–2m)", base: 82,
        subSubs: [
          { key: "startLineAccuracy", label: "Start Line Accuracy", base: 83 },
          { key: "confidencePutts", label: "Confidence Putts", base: 81 },
          { key: "pressurePutts", label: "Pressure Putts", base: 79 },
        ],
      },
      {
        key: "midPutting", label: "Mid Range (2–5m)", base: 78,
        subSubs: [
          { key: "speedControl", label: "Speed Control", base: 79 },
          { key: "directionControl", label: "Direction Control", base: 77 },
        ],
      },
      {
        key: "longPutting", label: "Long Range (5m+)", base: 75,
        subSubs: [
          { key: "lagPutting", label: "Lag Putting", base: 76 },
          { key: "distanceControl", label: "Distance Control", base: 74 },
          { key: "threePuttAvoidance", label: "Three-Putt Avoidance", base: 73 },
        ],
      },
      {
        key: "greenReading", label: "Green Reading", base: 77,
        subSubs: [
          { key: "slopeReading", label: "Slope Reading", base: 78 },
          { key: "breakRecognition", label: "Break Recognition", base: 76 },
          { key: "speedPrediction", label: "Speed Prediction", base: 75 },
        ],
      },
      {
        key: "strokeMechanics", label: "Stroke Mechanics", base: 80,
        subSubs: [
          { key: "faceControl", label: "Face Control", base: 81 },
          { key: "pathControl", label: "Path Control", base: 80 },
          { key: "rhythmTempo", label: "Rhythm & Tempo", base: 79 },
        ],
      },
    ],
  },
  {
    key: "shortGame",
    label: "Short Game",
    base: 56,
    color: "#06b6d4",
    subs: [
      {
        key: "chipping", label: "Chipping", base: 58,
        subSubs: [
          { key: "basicChip", label: "Basic Chip", base: 60 },
          { key: "bumpRun", label: "Bump & Run", base: 57 },
          { key: "highChip", label: "High Chip", base: 54 },
        ],
      },
      {
        key: "pitching", label: "Pitching", base: 55,
        subSubs: [
          { key: "pitchShots15", label: "Pitch Shots <15m", base: 58 },
          { key: "pitchShots1530", label: "Pitch Shots 15–30m", base: 55 },
          { key: "pitchShots3050", label: "Pitch Shots 30–50m", base: 52 },
        ],
      },
      {
        key: "wedgePlay", label: "Wedge Play", base: 54,
        subSubs: [
          { key: "wedge50m", label: "50m Wedges", base: 56 },
          { key: "wedge75m", label: "75m Wedges", base: 54 },
          { key: "wedge100m", label: "100m Wedges", base: 52 },
          { key: "wedgeDistanceControl", label: "Distance Control", base: 53 },
        ],
      },
      {
        key: "bunkerPlay", label: "Bunker Play", base: 50,
        subSubs: [
          { key: "greensideBunker", label: "Greenside Bunker", base: 52 },
          { key: "fairwayBunker", label: "Fairway Bunker", base: 49 },
          { key: "distanceBunkerShot", label: "Distance Bunker Shot", base: 48 },
        ],
      },
      {
        key: "upAndDown", label: "Up & Down Skills", base: 57,
        subSubs: [
          { key: "recoverySuccess", label: "Recovery Success", base: 58 },
          { key: "scrambling", label: "Scrambling", base: 56 },
        ],
      },
      {
        key: "spinTrajectory", label: "Spin & Trajectory", base: 53,
        subSubs: [
          { key: "lowFlight", label: "Low Flight", base: 55 },
          { key: "standardFlight", label: "Standard Flight", base: 54 },
          { key: "highFlight", label: "High Flight", base: 51 },
        ],
      },
    ],
  },
  {
    key: "longGame",
    label: "Long Game",
    base: 72,
    color: "#f59e0b",
    subs: [
      {
        key: "driver", label: "Driver", base: 74,
        subSubs: [
          { key: "driverAccuracy", label: "Accuracy", base: 72 },
          { key: "driverDistance", label: "Distance", base: 78 },
          { key: "launchConditions", label: "Launch Conditions", base: 73 },
          { key: "fairwaysHit", label: "Fairways Hit", base: 70 },
        ],
      },
      {
        key: "fairwayWoods", label: "Fairway Woods", base: 72,
        subSubs: [
          { key: "fwAccuracy", label: "Accuracy", base: 72 },
          { key: "fwDistance", label: "Distance", base: 73 },
          { key: "turfContact", label: "Turf Contact", base: 70 },
        ],
      },
      {
        key: "hybrids", label: "Hybrids", base: 73,
        subSubs: [
          { key: "hybridAccuracy", label: "Accuracy", base: 74 },
          { key: "hybridConsistency", label: "Consistency", base: 72 },
        ],
      },
      {
        key: "longIrons", label: "Long Irons", base: 68,
        subSubs: [
          { key: "strikeQuality", label: "Strike Quality", base: 68 },
          { key: "liDistanceControl", label: "Distance Control", base: 67 },
        ],
      },
      {
        key: "midIrons", label: "Mid Irons", base: 72,
        subSubs: [
          { key: "miDirectionControl", label: "Direction Control", base: 72 },
          { key: "miDistanceControl", label: "Distance Control", base: 71 },
        ],
      },
      {
        key: "shortIrons", label: "Short Irons", base: 75,
        subSubs: [
          { key: "precision", label: "Precision", base: 76 },
          { key: "targetAccuracy", label: "Target Accuracy", base: 74 },
        ],
      },
      {
        key: "shotShaping", label: "Shot Shaping", base: 65,
        subSubs: [
          { key: "fadeControl", label: "Fade Control", base: 66 },
          { key: "drawControl", label: "Draw Control", base: 65 },
          { key: "trajectoryControl", label: "Trajectory Control", base: 64 },
        ],
      },
      {
        key: "ballStriking", label: "Ball Striking", base: 73,
        subSubs: [
          { key: "centeredContact", label: "Centered Contact", base: 74 },
          { key: "bsConsistency", label: "Consistency", base: 73 },
          { key: "compression", label: "Compression", base: 72 },
        ],
      },
    ],
  },
  {
    key: "tactics",
    label: "Tactics",
    base: 64,
    color: "#ef4444",
    subs: [
      {
        key: "courseManagement", label: "Course Management", base: 66,
        subSubs: [
          { key: "riskAssessment", label: "Risk Assessment", base: 67 },
          { key: "safeVsAggressive", label: "Safe vs Aggressive", base: 65 },
          { key: "strategicPlanning", label: "Strategic Planning", base: 66 },
        ],
      },
      {
        key: "clubSelection", label: "Club Selection", base: 65,
        subSubs: [
          { key: "clubChoiceAccuracy", label: "Club Choice Accuracy", base: 66 },
          { key: "distanceStrategy", label: "Distance Strategy", base: 64 },
        ],
      },
      {
        key: "targetSelection", label: "Target Selection", base: 63,
        subSubs: [
          { key: "aimingStrategy", label: "Aiming Strategy", base: 64 },
          { key: "landingZoneSelection", label: "Landing Zone Selection", base: 62 },
        ],
      },
      {
        key: "recoveryManagement", label: "Recovery Management", base: 62,
        subSubs: [
          { key: "troubleShotDecisions", label: "Trouble Shot Decisions", base: 63 },
          { key: "rmRecoverySuccess", label: "Recovery Success", base: 61 },
        ],
      },
      {
        key: "scoringStrategy", label: "Scoring Strategy", base: 64,
        subSubs: [
          { key: "birdieOpportunities", label: "Birdie Opportunities", base: 65 },
          { key: "bogeyAvoidance", label: "Bogey Avoidance", base: 64 },
          { key: "roundManagement", label: "Round Management", base: 63 },
        ],
      },
      {
        key: "competitionManagement", label: "Competition Mgmt", base: 60,
        subSubs: [
          { key: "pressureDecisions", label: "Pressure Decisions", base: 61 },
          { key: "tournamentStrategy", label: "Tournament Strategy", base: 59 },
        ],
      },
    ],
  },
  {
    key: "fitness",
    label: "Fitness",
    base: 51,
    color: "#f97316",
    subs: [
      {
        key: "mobility", label: "Mobility", base: 53,
        subSubs: [
          { key: "shoulderMobility", label: "Shoulder Mobility", base: 54 },
          { key: "hipMobility", label: "Hip Mobility", base: 52 },
          { key: "thoracicMobility", label: "Thoracic Mobility", base: 51 },
          { key: "ankleMobility", label: "Ankle Mobility", base: 50 },
        ],
      },
      {
        key: "stability", label: "Stability", base: 52,
        subSubs: [
          { key: "coreStability", label: "Core Stability", base: 53 },
          { key: "singleLegStability", label: "Single-Leg Stability", base: 51 },
          { key: "rotationalStability", label: "Rotational Stability", base: 52 },
        ],
      },
      {
        key: "strength", label: "Strength", base: 50,
        subSubs: [
          { key: "upperBodyStrength", label: "Upper Body Strength", base: 51 },
          { key: "lowerBodyStrength", label: "Lower Body Strength", base: 50 },
          { key: "coreStrength", label: "Core Strength", base: 49 },
        ],
      },
      {
        key: "power", label: "Power", base: 49,
        subSubs: [
          { key: "rotationalPower", label: "Rotational Power", base: 50 },
          { key: "explosiveness", label: "Explosiveness", base: 48 },
          { key: "speedGeneration", label: "Speed Generation", base: 49 },
        ],
      },
      {
        key: "endurance", label: "Endurance", base: 52,
        subSubs: [
          { key: "walkingEndurance", label: "Walking Endurance", base: 54 },
          { key: "trainingCapacity", label: "Training Capacity", base: 51 },
        ],
      },
      {
        key: "balance", label: "Balance", base: 53,
        subSubs: [
          { key: "staticBalance", label: "Static Balance", base: 54 },
          { key: "dynamicBalance", label: "Dynamic Balance", base: 52 },
        ],
      },
    ],
  },
  {
    key: "mental",
    label: "Mental",
    base: 59,
    color: "#3b82f6",
    subs: [
      {
        key: "focus", label: "Focus", base: 61,
        subSubs: [
          { key: "concentration", label: "Concentration", base: 62 },
          { key: "presentMomentAwareness", label: "Present-Moment Awareness", base: 60 },
        ],
      },
      {
        key: "confidence", label: "Confidence", base: 60,
        subSubs: [
          { key: "selfBelief", label: "Self-Belief", base: 61 },
          { key: "trustInTechnique", label: "Trust in Technique", base: 59 },
        ],
      },
      {
        key: "emotionalControl", label: "Emotional Control", base: 58,
        subSubs: [
          { key: "frustrationManagement", label: "Frustration Management", base: 59 },
          { key: "responseAfterMistakes", label: "Response After Mistakes", base: 57 },
        ],
      },
      {
        key: "resilience", label: "Resilience", base: 59,
        subSubs: [
          { key: "bounceBackAbility", label: "Bounce-Back Ability", base: 60 },
          { key: "consistencyUnderPressure", label: "Consistency Under Pressure", base: 58 },
        ],
      },
      {
        key: "competitiveMindset", label: "Competitive Mindset", base: 57,
        subSubs: [
          { key: "confidenceInCompetition", label: "Confidence in Competition", base: 58 },
          { key: "pressureHandling", label: "Pressure Handling", base: 56 },
        ],
      },
      {
        key: "routineCommitment", label: "Routine Commitment", base: 60,
        subSubs: [
          { key: "mentalPreparation", label: "Mental Preparation", base: 61 },
          { key: "preShotDiscipline", label: "Pre-Shot Discipline", base: 59 },
        ],
      },
    ],
  },
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

    const subs: SubCapabilityScore[] = definition.subs.map((sub, si) => {
      const subRoll = hashToUnit(`${idSeed}:${definition.key}:sub:${sub.key}:${si}`);
      const subScore = clamp(
        Math.round(sub.base * MIN_BASE_MULTIPLIER + subRoll * VARIANCE_RANGE),
        1,
        100,
      );
      const subSubs: SubSubCapabilityScore[] = sub.subSubs.map((ss, ssi) => {
        const ssRoll = hashToUnit(`${idSeed}:${definition.key}:${sub.key}:ss:${ss.key}:${ssi}`);
        const ssScore = clamp(
          Math.round(ss.base * MIN_BASE_MULTIPLIER + ssRoll * VARIANCE_RANGE),
          1,
          100,
        );
        return { ...ss, score: ssScore, rating: scoreToRating(ssScore) };
      });
      return {
        key: sub.key,
        label: sub.label,
        base: sub.base,
        score: subScore,
        rating: scoreToRating(subScore),
        subSubs,
      };
    });

    return {
      key: definition.key,
      label: definition.label,
      base: definition.base,
      color: definition.color,
      score,
      rating: scoreToRating(score),
      subs,
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
