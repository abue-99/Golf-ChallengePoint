import { buildIcs, escapeText, foldLine, formatUtc } from './ics';

describe('ics', () => {
  it('escapes text values', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('formats UTC timestamps', () => {
    expect(formatUtc(new Date('2026-10-25T15:04:05Z'))).toBe(
      '20261025T150405Z',
    );
  });

  it('folds long lines at 75 octets', () => {
    const line = `SUMMARY:${'ä'.repeat(60)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('writes timed and all-day events', () => {
    const ics = buildIcs({
      name: 'Test',
      timeZone: 'Europe/Berlin',
      now: new Date('2026-10-01T00:00:00Z'),
      events: [
        {
          uid: 'a@x',
          title: 'Training, U16',
          start: new Date('2026-10-25T15:00:00Z'),
          end: new Date('2026-10-25T16:30:00Z'),
          status: 'TENTATIVE',
        },
        {
          uid: 'b@x',
          title: 'Milestone',
          start: new Date('2026-10-26T23:30:00Z'),
          end: new Date('2026-10-26T23:30:00Z'),
          allDay: true,
        },
      ],
    });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261025T150000Z\r\nDTEND:20261025T163000Z');
    expect(ics).toContain('SUMMARY:Training\\, U16');
    expect(ics).toContain('STATUS:TENTATIVE');
    // 23:30 UTC is already the 27th in Berlin.
    expect(ics).toContain(
      'DTSTART;VALUE=DATE:20261027\r\nDTEND;VALUE=DATE:20261028',
    );
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
