import {
  applyExceptions,
  expandEffective,
  findEffectiveOccurrence,
  fitsEffectiveOccurrence,
  insideCancelledOccurrence,
  type SlotException,
} from './occurrences';

// Weekly on Monday 16:00–17:30 UTC.
const weekly = {
  startTime: new Date('2030-01-07T16:00:00Z'),
  endTime: new Date('2030-01-07T17:30:00Z'),
  recurrence: 'WEEKLY',
  recurrenceEndDate: null,
};

const d = (value: string) => new Date(value);

const moved: SlotException = {
  originalStart: d('2030-01-14T16:00:00Z'),
  cancelled: false,
  newStart: d('2030-01-16T17:00:00Z'),
  newEnd: d('2030-01-16T18:00:00Z'),
  reason: 'Course busy',
};
const cancelled: SlotException = {
  originalStart: d('2030-01-21T16:00:00Z'),
  cancelled: true,
  newStart: null,
  newEnd: null,
  reason: 'Holiday',
};

describe('expandEffective', () => {
  it('moves and cancels single occurrences, the series stays', () => {
    const list = expandEffective(
      weekly,
      [moved, cancelled],
      d('2030-01-07T00:00:00Z'),
      d('2030-01-29T00:00:00Z'),
    );
    expect(list.map((o) => [o.start.toISOString(), o.status])).toEqual([
      ['2030-01-07T16:00:00.000Z', 'scheduled'],
      ['2030-01-16T17:00:00.000Z', 'moved'],
      ['2030-01-21T16:00:00.000Z', 'cancelled'],
      ['2030-01-28T16:00:00.000Z', 'scheduled'],
    ]);
    expect(list[1].originalStart.toISOString()).toBe(
      '2030-01-14T16:00:00.000Z',
    );
    expect(list[1].originalEnd.toISOString()).toBe('2030-01-14T17:30:00.000Z');
    expect(list[2].reason).toBe('Holiday');
  });

  it('follows a moved occurrence into and out of the window', () => {
    // Window only covers the new day (Wednesday).
    const into = expandEffective(
      weekly,
      [moved],
      d('2030-01-16T00:00:00Z'),
      d('2030-01-16T23:59:00Z'),
    );
    expect(into).toHaveLength(1);
    expect(into[0].status).toBe('moved');
    // Window only covers the old day (Monday): nothing takes place there.
    const outOf = expandEffective(
      weekly,
      [moved],
      d('2030-01-14T00:00:00Z'),
      d('2030-01-14T23:59:00Z'),
    );
    expect(outOf).toHaveLength(0);
  });

  it('ignores exceptions that no longer match the series', () => {
    const stale: SlotException = {
      ...moved,
      originalStart: d('2030-01-15T16:00:00Z'),
    };
    const list = expandEffective(
      weekly,
      [stale],
      d('2030-01-14T00:00:00Z'),
      d('2030-01-17T00:00:00Z'),
    );
    expect(list.map((o) => o.status)).toEqual(['scheduled']);
  });

  it('works on a precomputed list without a window', () => {
    const list = applyExceptions(
      weekly,
      [
        { start: d('2030-01-14T16:00:00Z'), end: d('2030-01-14T17:30:00Z') },
        { start: d('2030-01-21T16:00:00Z'), end: d('2030-01-21T17:30:00Z') },
      ],
      [moved, cancelled],
    );
    expect(list.map((o) => o.status)).toEqual(['moved', 'cancelled']);
  });
});

describe('findEffectiveOccurrence', () => {
  it('finds a moved one by its new start and a cancelled one by the series start', () => {
    expect(
      findEffectiveOccurrence(weekly, [moved], d('2030-01-16T17:00:00Z'))
        ?.status,
    ).toBe('moved');
    expect(
      findEffectiveOccurrence(weekly, [moved], d('2030-01-14T16:00:00Z')),
    ).toBeNull();
    expect(
      findEffectiveOccurrence(weekly, [cancelled], d('2030-01-21T16:00:00Z'))
        ?.status,
    ).toBe('cancelled');
  });
});

describe('lesson placement', () => {
  it('fits a lesson into the moved time, not into a cancelled one', () => {
    expect(
      fitsEffectiveOccurrence(
        weekly,
        [moved],
        d('2030-01-16T17:15:00Z'),
        d('2030-01-16T17:45:00Z'),
      ),
    ).toBe(true);
    expect(
      fitsEffectiveOccurrence(
        weekly,
        [cancelled],
        d('2030-01-21T16:00:00Z'),
        d('2030-01-21T16:30:00Z'),
      ),
    ).toBe(false);
    expect(
      insideCancelledOccurrence(
        weekly,
        [cancelled],
        d('2030-01-21T16:00:00Z'),
        d('2030-01-21T16:30:00Z'),
      ),
    ).toBe(true);
  });
});
