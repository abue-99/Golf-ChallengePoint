import {
  daysWithin,
  findDuplicates,
  loadLevel,
  summarizeWeeks,
  weekStarts,
  zonedDayStart,
} from './player-load';

const TZ = 'Europe/Berlin';

describe('week bounds', () => {
  it('finds Monday 00:00 in the time zone, also across the DST change', () => {
    // Sunday 25 Oct 2026, the day summer time ends.
    const starts = weekStarts(new Date('2026-10-25T18:00:00Z'), TZ, 2);
    expect(starts.map((d) => d.toISOString())).toEqual([
      '2026-10-18T22:00:00.000Z', // Mon 19 Oct 00:00 CEST
      '2026-10-25T23:00:00.000Z', // Mon 26 Oct 00:00 CET
      '2026-11-01T23:00:00.000Z',
    ]);
    expect(zonedDayStart('2026-03-29', TZ).toISOString()).toBe(
      '2026-03-28T23:00:00.000Z',
    );
  });

  it('counts tournament days inside a week', () => {
    const from = new Date('2026-10-25T23:00:00Z');
    const to = new Date('2026-11-01T23:00:00Z');
    expect(
      daysWithin(
        new Date('2026-10-31T07:00:00Z'),
        new Date('2026-11-02T16:00:00Z'),
        from,
        to,
        TZ,
      ),
    ).toBe(2);
  });
});

describe('summarizeWeeks', () => {
  it('sums per week, kind and coach and rates the load', () => {
    const starts = [
      new Date('2026-10-25T23:00:00Z'),
      new Date('2026-11-01T23:00:00Z'),
      new Date('2026-11-08T23:00:00Z'),
    ];
    const weeks = summarizeWeeks({
      items: [
        {
          start: new Date('2026-10-27T15:00:00Z'),
          minutes: 90,
          kind: 'training',
          coachId: 'a',
        },
        {
          start: new Date('2026-10-28T15:00:00Z'),
          minutes: 60,
          kind: 'session',
          coachId: 'b',
        },
        {
          start: new Date('2026-10-29T15:00:00Z'),
          minutes: 30,
          kind: 'lesson',
          coachId: 'a',
        },
        {
          start: new Date('2026-11-03T15:00:00Z'),
          minutes: 100,
          kind: 'training',
          coachId: 'a',
        },
      ],
      tournaments: [],
      starts,
      limit: 200,
      coachName: (id) => (id === 'a' ? 'You' : 'Ben'),
      timeZone: TZ,
    });
    expect(weeks).toHaveLength(2);
    expect(weeks[0].minutes).toBe(180);
    expect(weeks[0].level).toBe('high');
    expect(weeks[0].byKind).toEqual({
      training: 90,
      event: 0,
      session: 60,
      lesson: 30,
    });
    expect(weeks[0].byCoach).toEqual([
      { coachId: 'a', name: 'You', minutes: 120 },
      { coachId: 'b', name: 'Ben', minutes: 60 },
    ]);
    expect(weeks[1].level).toBe('ok');
    expect(loadLevel(201, 200)).toBe('over');
  });
});

describe('findDuplicates', () => {
  it('reports lessons open from two or more coaches only', () => {
    const result = findDuplicates(
      [
        { lessonId: 'l1', lessonName: 'Putting', coachId: 'a' },
        { lessonId: 'l1', lessonName: 'Putting', coachId: 'b' },
        { lessonId: 'l2', lessonName: 'Chipping', coachId: 'a' },
        { lessonId: 'l2', lessonName: 'Chipping', coachId: 'a' },
      ],
      (id) => (id === 'a' ? 'You' : 'Ben'),
    );
    expect(result).toEqual([
      {
        lessonId: 'l1',
        lessonName: 'Putting',
        coachIds: ['a', 'b'],
        coaches: ['You', 'Ben'],
      },
    ]);
  });
});
