/**
 * Pure rules of the player game: XP values, levels, stars, weekly streak,
 * player card, badges and weekly quests. No database access here, so the
 * rules are easy to test.
 */

export const FOCUS_AREAS = [
  'SETUP',
  'PUTTING',
  'SHORT_GAME',
  'LONG_GAME',
  'TACTICAL',
  'FITNESS',
  'MENTAL',
] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

export const FOCUS_LABEL: Record<FocusArea, string> = {
  SETUP: 'Setup',
  PUTTING: 'Putting',
  SHORT_GAME: 'Short Game',
  LONG_GAME: 'Long Game',
  TACTICAL: 'Tactics',
  FITNESS: 'Fitness',
  MENTAL: 'Mental',
};

/** Event types of the XP ledger / activity feed. */
export const EVENT = {
  LESSON_COMPLETED: 'LESSON_COMPLETED',
  LESSON_STARTED: 'LESSON_STARTED',
  BLOCK_COMPLETED: 'BLOCK_COMPLETED',
  JOURNEY_COMPLETED: 'JOURNEY_COMPLETED',
  JOURNEY_ACCEPTED: 'JOURNEY_ACCEPTED',
  SESSION_COMPLETED: 'SESSION_COMPLETED',
  TEAM_SESSION: 'TEAM_SESSION',
  ATTENDANCE_ANSWERED: 'ATTENDANCE_ANSWERED',
  QUESTION_ANSWERED: 'QUESTION_ANSWERED',
  COACH_REVIEW: 'COACH_REVIEW',
  CHALLENGE_ENTRY: 'CHALLENGE_ENTRY',
  QUEST_COMPLETED: 'QUEST_COMPLETED',
  WEEK_GOAL: 'WEEK_GOAL',
  BADGE_EARNED: 'BADGE_EARNED',
  LEVEL_UP: 'LEVEL_UP',
  LEAGUE_PODIUM: 'LEAGUE_PODIUM',
} as const;
export type EventType = (typeof EVENT)[keyof typeof EVENT];

/** Events that make a day a practice day for the weekly goal. */
export const PRACTICE_EVENTS: string[] = [
  EVENT.LESSON_COMPLETED,
  EVENT.SESSION_COMPLETED,
  EVENT.TEAM_SESSION,
  EVENT.CHALLENGE_ENTRY,
];

export const XP = {
  missionBase: 50,
  /** +1 XP per 5 planned minutes, at most this much. */
  missionDurationCap: 30,
  perExtraStar: 10,
  block: 150,
  journey: 500,
  journeyAccepted: 10,
  session: 20,
  teamSession: 15,
  attendance: 5,
  question: 10,
  reviewPerStar: 10,
  coachPick: 20,
  challenge: 20,
  quest: 30,
  weekGoal: 40,
  badge: 25,
  podium: [50, 30, 20],
} as const;

export function missionXp(durationMinutes: number, stars: number) {
  const duration = Math.min(
    XP.missionDurationCap,
    Math.floor(Math.max(0, durationMinutes) / 5),
  );
  return XP.missionBase + duration + Math.max(0, stars - 1) * XP.perExtraStar;
}

export function reviewXp(rating: number, pick: boolean) {
  return (
    Math.max(0, Math.min(5, rating)) * XP.reviewPerStar +
    (pick ? XP.coachPick : 0)
  );
}

// ── Levels ─────────────────────────────────────────────────────────────

/** Total XP needed to reach `level` (level 1 = 0, 2 = 100, 3 = 300, 4 = 600 …). */
export function levelThreshold(level: number) {
  return 50 * level * (level - 1);
}

export function levelForXp(xp: number) {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (levelThreshold(level + 1) <= safe) level += 1;
  const start = levelThreshold(level);
  const next = levelThreshold(level + 1);
  return {
    xp: safe,
    level,
    levelStartXp: start,
    nextLevelXp: next,
    progress: Math.round(((safe - start) / (next - start)) * 100),
    tier: cardTier(level),
  };
}

export type CardTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'ELITE';

export function cardTier(level: number): CardTier {
  if (level >= 15) return 'ELITE';
  if (level >= 10) return 'GOLD';
  if (level >= 5) return 'SILVER';
  return 'BRONZE';
}

// ── Stars ──────────────────────────────────────────────────────────────

/**
 * 1–3 stars for a completed mission. With a measurable target the result
 * decides; without one, ticking every exercise and practising (almost) the
 * planned time earn a star each.
 */
export function missionStars(input: {
  resultScore?: number | null;
  targetScore?: number | null;
  exerciseCount: number;
  exercisesDone: number;
  practiceMinutes?: number | null;
  durationMinutes: number;
}) {
  const target = input.targetScore ?? null;
  if (target !== null && target > 0 && input.resultScore != null) {
    if (input.resultScore >= target) return 3;
    if (input.resultScore >= Math.ceil(target * 0.7)) return 2;
    return 1;
  }
  let stars = 1;
  if (input.exerciseCount > 0 && input.exercisesDone >= input.exerciseCount) {
    stars += 1;
  }
  if (
    input.practiceMinutes != null &&
    input.durationMinutes > 0 &&
    input.practiceMinutes >= input.durationMinutes * 0.8
  ) {
    stars += 1;
  }
  return Math.min(3, stars);
}

/** Exercises of a lesson: one per line (or ";"), bullets removed. */
export function splitExercises(text: string | null | undefined) {
  if (!text) return [];
  return text
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

// ── Weeks ──────────────────────────────────────────────────────────────

/** Monday (YYYY-MM-DD) of the week that contains the day key. */
export function weekOf(dayKey: string) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return date.toISOString().slice(0, 10);
}

export function addDays(dayKey: string, days: number) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
}

export const DEFAULT_WEEKLY_GOAL = 3;
export const FREEZE_EVERY_WEEKS = 4;
export const MAX_FREEZES = 2;

export type WeekResult = 'reached' | 'protected' | 'frozen' | 'missed';

/**
 * Weekly streak: consecutive weeks in which the weekly goal (practice days)
 * was reached. Weeks with a tournament or a holiday don't break the streak.
 * Every 4 reached weeks earn a freeze (max 2) that saves a missed week.
 * The running week only counts once its goal is reached.
 */
export function weeklyStreak(input: {
  practiceDays: Iterable<string>;
  protectedWeeks: Iterable<string>;
  goal: number;
  today: string;
}) {
  const goal = Math.max(1, Math.min(7, Math.round(input.goal)));
  const perWeek = new Map<string, Set<string>>();
  for (const day of input.practiceDays) {
    if (day > input.today) continue;
    const week = weekOf(day);
    if (!perWeek.has(week)) perWeek.set(week, new Set());
    perWeek.get(week)!.add(day);
  }
  const protectedWeeks = new Set(input.protectedWeeks);
  const currentWeek = weekOf(input.today);
  const thisWeekDays = [...(perWeek.get(currentWeek) ?? [])].sort();

  const weeks = [...perWeek.keys()].sort();
  let streak = 0;
  let best = 0;
  let freezes = 0;
  let reachedInRow = 0;
  const history: { week: string; result: WeekResult; days: number }[] = [];
  if (weeks.length > 0) {
    for (let week = weeks[0]; week < currentWeek; week = addDays(week, 7)) {
      const days = perWeek.get(week)?.size ?? 0;
      let result: WeekResult;
      if (days >= goal) {
        streak += 1;
        reachedInRow += 1;
        if (reachedInRow % FREEZE_EVERY_WEEKS === 0) {
          freezes = Math.min(MAX_FREEZES, freezes + 1);
        }
        result = 'reached';
      } else if (protectedWeeks.has(week)) {
        result = 'protected';
      } else if (streak > 0 && freezes > 0) {
        freezes -= 1;
        result = 'frozen';
      } else {
        streak = 0;
        reachedInRow = 0;
        result = 'missed';
      }
      best = Math.max(best, streak);
      history.push({ week, result, days });
    }
  }
  const reachedThisWeek = thisWeekDays.length >= goal;
  const current = streak + (reachedThisWeek ? 1 : 0);
  best = Math.max(best, current);
  return {
    goal,
    week: currentWeek,
    thisWeekDays,
    reachedThisWeek,
    weekStreak: current,
    bestWeekStreak: best,
    freezes,
    history: history.slice(-12),
  };
}

// ── Player card ────────────────────────────────────────────────────────

export type RatingPoint = {
  area: string;
  /** 0–100 */
  value: number;
  weight: number;
  at: Date;
};

export const WEIGHT = { coach: 3, benchmark: 3, stars: 1.5, self: 1 } as const;

export function starsValue(stars: number) {
  return stars >= 3 ? 95 : stars === 2 ? 72 : 45;
}

/**
 * Attribute per focus area from real data only: coach ratings, benchmark
 * tests, mission stars and self-assessments (last 12 points, weighted),
 * plus a small bonus for experience. No data → null ("not rated yet").
 */
export function cardAttributes(input: {
  points: RatingPoint[];
  completedByArea: Record<string, number>;
  asOf?: Date;
}) {
  const asOf = input.asOf?.getTime() ?? Infinity;
  const attributes = FOCUS_AREAS.map((area) => {
    const points = input.points
      .filter((point) => point.area === area && point.at.getTime() <= asOf)
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 12);
    const completed = input.completedByArea[area] ?? 0;
    if (points.length === 0) {
      return {
        area,
        label: FOCUS_LABEL[area],
        score: null as number | null,
        completed,
        samples: 0,
      };
    }
    const weight = points.reduce((sum, point) => sum + point.weight, 0);
    const avg =
      points.reduce((sum, point) => sum + point.value * point.weight, 0) /
      weight;
    const score = Math.max(
      1,
      Math.min(99, Math.round(avg * 0.9 + Math.min(10, completed))),
    );
    return {
      area,
      label: FOCUS_LABEL[area],
      score,
      completed,
      samples: points.length,
    };
  });
  const rated = attributes.filter((attribute) => attribute.score !== null);
  const ovr = rated.length
    ? Math.round(
        rated.reduce((sum, attribute) => sum + (attribute.score ?? 0), 0) /
          rated.length,
      )
    : null;
  return { ovr, attributes };
}

// ── Badges ─────────────────────────────────────────────────────────────

export type BadgeStats = {
  missions: number;
  threeStarMissions: number;
  journeysCompleted: number;
  coachPicks: number;
  bestWeekStreak: number;
  level: number;
  attendanceAnswers: number;
  questionsAnswered: number;
  challengesEntered: number;
  earlyBird: boolean;
  missionsByArea: Record<string, number>;
  podiums: number;
};

export type BadgeDef = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  progress: (stats: BadgeStats) => { value: number; target: number };
};

const count = (value: number, target: number) => ({
  value: Math.min(value, target),
  target,
});

export const BADGES: BadgeDef[] = [
  {
    key: 'first_mission',
    title: 'First Tee',
    description: 'Complete your first mission',
    emoji: '⛳',
    progress: (s) => count(s.missions, 1),
  },
  {
    key: 'missions_10',
    title: 'Grinder',
    description: 'Complete 10 missions',
    emoji: '💪',
    progress: (s) => count(s.missions, 10),
  },
  {
    key: 'missions_50',
    title: 'Range Rat',
    description: 'Complete 50 missions',
    emoji: '🏌️',
    progress: (s) => count(s.missions, 50),
  },
  {
    key: 'three_stars',
    title: 'Bullseye',
    description: 'Earn 3 stars on a mission',
    emoji: '🎯',
    progress: (s) => count(s.threeStarMissions, 1),
  },
  {
    key: 'three_stars_10',
    title: 'Sharpshooter',
    description: 'Earn 3 stars on 10 missions',
    emoji: '🌟',
    progress: (s) => count(s.threeStarMissions, 10),
  },
  {
    key: 'journey_finisher',
    title: 'Finisher',
    description: 'Complete a whole journey',
    emoji: '🏁',
    progress: (s) => count(s.journeysCompleted, 1),
  },
  {
    key: 'coach_pick',
    title: "Coach's Pick",
    description: 'Get a mission picked by your coach',
    emoji: '🏅',
    progress: (s) => count(s.coachPicks, 1),
  },
  {
    key: 'streak_4',
    title: 'On Fire',
    description: 'Reach your weekly goal 4 weeks in a row',
    emoji: '🔥',
    progress: (s) => count(s.bestWeekStreak, 4),
  },
  {
    key: 'streak_12',
    title: 'Unstoppable',
    description: 'Reach your weekly goal 12 weeks in a row',
    emoji: '☄️',
    progress: (s) => count(s.bestWeekStreak, 12),
  },
  {
    key: 'level_5',
    title: 'Silver Card',
    description: 'Reach level 5',
    emoji: '🥈',
    progress: (s) => count(s.level, 5),
  },
  {
    key: 'level_10',
    title: 'Gold Card',
    description: 'Reach level 10',
    emoji: '🥇',
    progress: (s) => count(s.level, 10),
  },
  {
    key: 'team_player',
    title: 'Team Player',
    description: 'Answer 10 team session invites',
    emoji: '🤝',
    progress: (s) => count(s.attendanceAnswers, 10),
  },
  {
    key: 'good_listener',
    title: 'Good Listener',
    description: "Answer 5 of your coach's questions",
    emoji: '💬',
    progress: (s) => count(s.questionsAnswered, 5),
  },
  {
    key: 'challenger',
    title: 'Challenger',
    description: 'Take part in 3 challenges',
    emoji: '⚔️',
    progress: (s) => count(s.challengesEntered, 3),
  },
  {
    key: 'podium',
    title: 'Podium',
    description: 'Finish a week in the top 3 of your team league',
    emoji: '🏆',
    progress: (s) => count(s.podiums, 1),
  },
  {
    key: 'early_bird',
    title: 'Early Bird',
    description: 'Finish a mission before 8 am',
    emoji: '🌅',
    progress: (s) => count(s.earlyBird ? 1 : 0, 1),
  },
  ...FOCUS_AREAS.map((area) => ({
    key: `area_${area.toLowerCase()}`,
    title: `${FOCUS_LABEL[area]} Specialist`,
    description: `Complete 10 ${FOCUS_LABEL[area].toLowerCase()} missions`,
    emoji: (
      {
        SETUP: '📐',
        PUTTING: '🕳️',
        SHORT_GAME: '🪃',
        LONG_GAME: '🚀',
        TACTICAL: '🧠',
        FITNESS: '🏋️',
        MENTAL: '🧘',
      } as Record<string, string>
    )[area],
    progress: (s: BadgeStats) => count(s.missionsByArea[area] ?? 0, 10),
  })),
];

export function earnedBadges(stats: BadgeStats) {
  return BADGES.filter((badge) => {
    const { value, target } = badge.progress(stats);
    return value >= target;
  }).map((badge) => badge.key);
}

// ── Quests ─────────────────────────────────────────────────────────────

export type QuestWeekStats = {
  missions: number;
  threeStars: number;
  practiceMinutes: number;
  attendanceAnswers: number;
  reflections: number;
  challengeEntries: number;
};

export type QuestDef = {
  key: string;
  title: string;
  emoji: string;
  target: number;
  value: (week: QuestWeekStats) => number;
};

const QUESTS: Record<string, QuestDef> = {
  missions_2: {
    key: 'missions_2',
    title: 'Complete 2 missions',
    emoji: '🎯',
    target: 2,
    value: (w) => w.missions,
  },
  three_star: {
    key: 'three_star',
    title: 'Earn 3 stars on a mission',
    emoji: '⭐',
    target: 1,
    value: (w) => w.threeStars,
  },
  minutes_60: {
    key: 'minutes_60',
    title: 'Practise 60 minutes',
    emoji: '⏱️',
    target: 60,
    value: (w) => w.practiceMinutes,
  },
  reflect_2: {
    key: 'reflect_2',
    title: 'Rate yourself and add a note on 2 missions',
    emoji: '📝',
    target: 2,
    value: (w) => w.reflections,
  },
  rsvp: {
    key: 'rsvp',
    title: 'Answer a team session invite',
    emoji: '👥',
    target: 1,
    value: (w) => w.attendanceAnswers,
  },
  challenge: {
    key: 'challenge',
    title: 'Post a challenge score',
    emoji: '⚔️',
    target: 1,
    value: (w) => w.challengeEntries,
  },
};

/** Three quests per week, stable for the whole week. */
export function weeklyQuests(
  week: string,
  options: { inTeam: boolean; hasChallenge: boolean },
) {
  const rotation = ['three_star', 'minutes_60', 'reflect_2'];
  const index =
    Math.floor(Date.parse(`${week}T12:00:00Z`) / (7 * 86_400_000)) %
    rotation.length;
  const keys = ['missions_2', rotation[index]];
  if (options.hasChallenge) keys.push('challenge');
  else if (options.inTeam) keys.push('rsvp');
  else keys.push(rotation[(index + 1) % rotation.length]);
  return keys.map((key) => QUESTS[key]);
}

export function questProgress(quests: QuestDef[], stats: QuestWeekStats) {
  return quests.map((quest) => {
    const value = Math.min(quest.target, quest.value(stats));
    return { ...quest, value, done: value >= quest.target, xp: XP.quest };
  });
}
