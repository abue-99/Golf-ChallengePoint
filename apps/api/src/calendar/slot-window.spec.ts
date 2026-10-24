import { fitsAnOccurrence } from './slot-window';

describe('fitsAnOccurrence', () => {
  // Weekly Tuesday 16:00–18:00 Berlin, created in summer (14:00 UTC).
  const weekly = {
    startTime: new Date('2026-09-01T14:00:00Z'),
    endTime: new Date('2026-09-01T16:00:00Z'),
    recurrence: 'WEEKLY',
    recurrenceEndDate: null,
  };

  it('accepts a session inside a winter occurrence', () => {
    // 27 Oct is after the DST change: the window is 15:00–17:00 UTC.
    const expected = process.env.TZ === 'Europe/Berlin';
    const start = new Date('2026-10-27T15:30:00Z');
    const end = new Date('2026-10-27T17:00:00Z');
    expect(fitsAnOccurrence(weekly, start, end)).toBe(expected);
  });

  it('rejects sessions outside every occurrence', () => {
    expect(
      fitsAnOccurrence(
        weekly,
        new Date('2026-10-28T15:00:00Z'),
        new Date('2026-10-28T16:00:00Z'),
      ),
    ).toBe(false);
    expect(
      fitsAnOccurrence(
        { ...weekly, recurrence: 'NONE' },
        new Date('2026-09-01T15:30:00Z'),
        new Date('2026-09-01T16:30:00Z'),
      ),
    ).toBe(false);
  });

  it('accepts one-time windows', () => {
    expect(
      fitsAnOccurrence(
        { ...weekly, recurrence: 'NONE' },
        new Date('2026-09-01T14:00:00Z'),
        new Date('2026-09-01T15:00:00Z'),
      ),
    ).toBe(true);
  });
});
