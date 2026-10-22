import {
  buildActivityDays,
  buildDayKeys,
  dayKey,
  expandOccurrences,
  nextOccurrence,
  resolveTimeZone,
  shiftDayKey,
} from './roster.helpers';

describe('roster helpers', () => {
  it('builds day keys in the viewer time zone', () => {
    // 23:30 UTC on 24 Oct is already 25 Oct in Berlin (UTC+2).
    expect(dayKey(new Date('2026-10-24T23:30:00Z'), 'Europe/Berlin')).toBe(
      '2026-10-25',
    );
    expect(dayKey(new Date('2026-10-24T23:30:00Z'), 'UTC')).toBe('2026-10-24');
  });

  it('shifts day keys across DST and month boundaries', () => {
    expect(shiftDayKey('2026-10-24', 2)).toBe('2026-10-26');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(buildDayKeys('2026-10-22', 1, 1)).toEqual([
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ]);
  });

  it('falls back for invalid time zones', () => {
    expect(resolveTimeZone('Not/AZone', 'Europe/Berlin')).toBe('Europe/Berlin');
    expect(resolveTimeZone(undefined, 'Bad/Zone')).toBe('UTC');
  });

  it('expands old weekly windows without hitting the occurrence limit', () => {
    const slot = {
      startTime: new Date('2015-01-06T16:00:00Z'),
      endTime: new Date('2015-01-06T18:00:00Z'),
      recurrence: 'WEEKLY',
      recurrenceEndDate: null,
    };
    const from = new Date('2026-10-16T00:00:00Z');
    const to = new Date('2026-10-30T00:00:00Z');
    const occurrences = expandOccurrences(slot, from, to);
    expect(occurrences).toHaveLength(2);
    occurrences.forEach((o) =>
      expect(o.start.getDay()).toBe(slot.startTime.getDay()),
    );
  });

  it('respects the recurrence end date and one-off windows', () => {
    const weekly = {
      startTime: new Date('2026-10-01T16:00:00Z'),
      endTime: new Date('2026-10-01T17:00:00Z'),
      recurrence: 'WEEKLY',
      recurrenceEndDate: new Date('2026-10-10T00:00:00Z'),
    };
    expect(
      expandOccurrences(
        weekly,
        new Date('2026-10-01T00:00:00Z'),
        new Date('2026-10-31T00:00:00Z'),
      ),
    ).toHaveLength(2);
    const once = { ...weekly, recurrence: 'NONE', recurrenceEndDate: null };
    expect(
      expandOccurrences(
        once,
        new Date('2026-10-05T00:00:00Z'),
        new Date('2026-10-31T00:00:00Z'),
      ),
    ).toHaveLength(0);
  });

  it('finds the next occurrence that has not ended', () => {
    const slot = {
      startTime: new Date('2026-09-01T16:00:00Z'),
      endTime: new Date('2026-09-01T18:00:00Z'),
      recurrence: 'DAILY',
      recurrenceEndDate: null,
    };
    const next = nextOccurrence(slot, new Date('2026-10-22T17:00:00Z'));
    expect(next?.start.toISOString()).toBe('2026-10-22T16:00:00.000Z');
  });

  it('derives day states', () => {
    const days = buildActivityDays({
      dayKeys: [
        '2026-10-20',
        '2026-10-21',
        '2026-10-22',
        '2026-10-23',
        '2026-10-24',
      ],
      today: '2026-10-22',
      completedDays: new Set(['2026-10-20']),
      taskDays: new Set(['2026-10-21', '2026-10-23']),
      windowDays: new Set(['2026-10-24', '2026-10-21']),
    });
    expect(days.map((d) => d.state)).toEqual([
      'done',
      'missed',
      'none',
      'planned',
      'planned',
    ]);
  });
});
