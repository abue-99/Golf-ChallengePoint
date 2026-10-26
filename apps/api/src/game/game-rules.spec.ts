import {
  addDays,
  cardAttributes,
  earnedBadges,
  levelForXp,
  missionStars,
  missionXp,
  questProgress,
  splitExercises,
  weekOf,
  weeklyQuests,
  weeklyStreak,
  type BadgeStats,
} from './game-rules';

describe('levels', () => {
  it('follows 0 / 100 / 300 / 600 / 1000', () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(99).level).toBe(1);
    expect(levelForXp(100).level).toBe(2);
    expect(levelForXp(299).level).toBe(2);
    expect(levelForXp(300).level).toBe(3);
    expect(levelForXp(1000).level).toBe(5);
    expect(levelForXp(1000).tier).toBe('SILVER');
  });

  it('reports progress inside the level', () => {
    const level = levelForXp(200);
    expect(level).toMatchObject({
      level: 2,
      levelStartXp: 100,
      nextLevelXp: 300,
      progress: 50,
    });
  });
});

describe('missions', () => {
  it('gives stars from the result against the target', () => {
    const base = {
      exerciseCount: 0,
      exercisesDone: 0,
      durationMinutes: 30,
      targetScore: 9,
    };
    expect(missionStars({ ...base, resultScore: 9 })).toBe(3);
    expect(missionStars({ ...base, resultScore: 7 })).toBe(2);
    expect(missionStars({ ...base, resultScore: 3 })).toBe(1);
  });

  it('without a target: exercises and practice time earn stars', () => {
    expect(
      missionStars({
        exerciseCount: 3,
        exercisesDone: 3,
        practiceMinutes: 25,
        durationMinutes: 30,
      }),
    ).toBe(3);
    expect(
      missionStars({
        exerciseCount: 3,
        exercisesDone: 2,
        practiceMinutes: 10,
        durationMinutes: 30,
      }),
    ).toBe(1);
  });

  it('XP grows with duration (capped) and stars', () => {
    expect(missionXp(30, 1)).toBe(56);
    expect(missionXp(30, 3)).toBe(76);
    expect(missionXp(600, 1)).toBe(80);
  });

  it('splits exercises by line or semicolon and strips bullets', () => {
    expect(
      splitExercises('- Ladder 6-9-12 m\n2) Gate drill;  • Pressure '),
    ).toEqual(['Ladder 6-9-12 m', 'Gate drill', 'Pressure']);
    expect(splitExercises(null)).toEqual([]);
  });
});

describe('weekly streak', () => {
  const days = (week: string, count: number) =>
    Array.from({ length: count }, (_, index) => addDays(week, index));

  it('counts consecutive weeks that reached the goal', () => {
    const result = weeklyStreak({
      practiceDays: [
        ...days('2026-10-05', 3),
        ...days('2026-10-12', 3),
        ...days('2026-10-19', 1),
      ],
      protectedWeeks: [],
      goal: 3,
      today: '2026-10-21',
    });
    expect(weekOf('2026-10-21')).toBe('2026-10-19');
    expect(result.weekStreak).toBe(2);
    expect(result.reachedThisWeek).toBe(false);
    expect(result.thisWeekDays).toEqual(['2026-10-19']);
  });

  it('adds the running week once the goal is reached', () => {
    const result = weeklyStreak({
      practiceDays: [...days('2026-10-12', 3), ...days('2026-10-19', 3)],
      protectedWeeks: [],
      goal: 3,
      today: '2026-10-22',
    });
    expect(result.weekStreak).toBe(2);
  });

  it('a missed week breaks it, a tournament week does not', () => {
    const base = [...days('2026-09-28', 3), ...days('2026-10-12', 3)];
    expect(
      weeklyStreak({
        practiceDays: base,
        protectedWeeks: [],
        goal: 3,
        today: '2026-10-20',
      }).weekStreak,
    ).toBe(1);
    expect(
      weeklyStreak({
        practiceDays: base,
        protectedWeeks: ['2026-10-05'],
        goal: 3,
        today: '2026-10-20',
      }).weekStreak,
    ).toBe(2);
  });

  it('four reached weeks earn a freeze that saves a missed week', () => {
    const practice = [
      ...days('2026-09-07', 2),
      ...days('2026-09-14', 2),
      ...days('2026-09-21', 2),
      ...days('2026-09-28', 2),
      // 2026-10-05 missed
      ...days('2026-10-12', 2),
    ];
    const result = weeklyStreak({
      practiceDays: practice,
      protectedWeeks: [],
      goal: 2,
      today: '2026-10-20',
    });
    expect(result.weekStreak).toBe(5);
    expect(result.freezes).toBe(0);
    expect(
      result.history.find((week) => week.week === '2026-10-05')?.result,
    ).toBe('frozen');
  });
});

describe('player card', () => {
  it('is empty without data and weights coach ratings higher', () => {
    expect(cardAttributes({ points: [], completedByArea: {} }).ovr).toBeNull();
    const at = new Date('2026-10-01');
    const card = cardAttributes({
      points: [
        { area: 'PUTTING', value: 100, weight: 3, at },
        { area: 'PUTTING', value: 40, weight: 1, at },
      ],
      completedByArea: { PUTTING: 2 },
    });
    const putting = card.attributes.find((a) => a.area === 'PUTTING');
    // (100*3 + 40)/4 = 85 → 85*0.9 + 2 = 78.5 → 79
    expect(putting?.score).toBe(79);
    expect(card.attributes.find((a) => a.area === 'MENTAL')?.score).toBeNull();
    expect(card.ovr).toBe(79);
  });

  it('ignores points after asOf', () => {
    const card = cardAttributes({
      points: [
        { area: 'SETUP', value: 80, weight: 1, at: new Date('2026-10-10') },
      ],
      completedByArea: {},
      asOf: new Date('2026-10-01'),
    });
    expect(card.ovr).toBeNull();
  });
});

describe('badges and quests', () => {
  const stats: BadgeStats = {
    missions: 10,
    threeStarMissions: 1,
    journeysCompleted: 0,
    coachPicks: 0,
    bestWeekStreak: 4,
    level: 3,
    attendanceAnswers: 0,
    questionsAnswered: 0,
    challengesEntered: 0,
    earlyBird: false,
    missionsByArea: { PUTTING: 10 },
    podiums: 0,
  };

  it('earns the matching badges', () => {
    const earned = earnedBadges(stats);
    expect(earned).toEqual(
      expect.arrayContaining([
        'first_mission',
        'missions_10',
        'three_stars',
        'streak_4',
        'area_putting',
      ]),
    );
    expect(earned).not.toContain('missions_50');
    expect(earned).not.toContain('level_5');
  });

  it('picks three stable quests per week', () => {
    const quests = weeklyQuests('2026-10-19', {
      inTeam: true,
      hasChallenge: false,
    });
    expect(quests).toHaveLength(3);
    expect(quests[0].key).toBe('missions_2');
    expect(quests[2].key).toBe('rsvp');
    expect(
      weeklyQuests('2026-10-19', { inTeam: true, hasChallenge: false }),
    ).toEqual(quests);
    const progress = questProgress(quests, {
      missions: 3,
      threeStars: 0,
      practiceMinutes: 30,
      attendanceAnswers: 1,
      reflections: 0,
      challengeEntries: 0,
    });
    expect(progress[0]).toMatchObject({ value: 2, done: true });
    expect(progress[2].done).toBe(true);
  });
});
