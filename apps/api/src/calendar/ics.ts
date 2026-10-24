/**
 * Minimal iCalendar (RFC 5545) writer for the calendar subscription feed.
 * Only what Apple Calendar, Outlook and Google Calendar need: VEVENTs with
 * UTC times or all-day dates, escaped text and folded lines.
 */

export type IcsEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  description?: string | null;
  location?: string | null;
  /** CONFIRMED (default), TENTATIVE or CANCELLED */
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  categories?: string[];
};

const PRODID = '-//Golf ChallengePoint//Calendar Feed//EN';

/** Escapes TEXT values: backslash, semicolon, comma and line breaks. */
export function escapeText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** 20261025T150000Z */
export function formatUtc(date: Date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** 20261025 – calendar date in the given time zone (for all-day events). */
export function formatDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}`;
}

/** Folds a content line to 75 octets, continuation lines start with a space. */
export function foldLine(line: string) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, 'utf8');
    const limit = out.length === 0 ? 75 : 74; // continuation lines carry a leading space
    if (currentBytes + size > limit) {
      out.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(options: {
  name: string;
  timeZone: string;
  events: IcsEvent[];
  now?: Date;
}) {
  const stamp = formatUtc(options.now ?? new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.name)}`,
    `X-WR-TIMEZONE:${options.timeZone}`,
    // Ask clients to refresh hourly (Apple/Outlook honour these).
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const event of options.events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (event.allDay) {
      const start = formatDate(event.start, options.timeZone);
      // DTEND is exclusive for all-day events: the day after the last day.
      const endBase =
        event.end.getTime() > event.start.getTime() ? event.end : event.start;
      const endDay = new Date(endBase.getTime() + 24 * 60 * 60 * 1000);
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${formatDate(endDay, options.timeZone)}`);
    } else {
      const end =
        event.end.getTime() > event.start.getTime()
          ? event.end
          : new Date(event.start.getTime() + 30 * 60 * 1000);
      lines.push(`DTSTART:${formatUtc(event.start)}`);
      lines.push(`DTEND:${formatUtc(end)}`);
    }
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.categories?.length) {
      lines.push(`CATEGORIES:${event.categories.map(escapeText).join(',')}`);
    }
    lines.push(`STATUS:${event.status ?? 'CONFIRMED'}`);
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
