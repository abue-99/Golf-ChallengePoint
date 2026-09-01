const DATE_TIME_PARTS = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
} as const;

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseNumber(value: string | undefined, fallback = 0) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDateTimeParts(date: Date, timeZone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    ...DATE_TIME_PARTS,
    timeZone,
  });

  const parts = formatter.formatToParts(date);
  const values: Partial<DateTimeParts> = {};

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      values[part.type] = parseNumber(part.value);
    }
  }

  return {
    year: values.year ?? 1970,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function getOffsetMs(date: Date, timeZone: string) {
  const zoned = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
  );
  return asUtc - date.getTime();
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return { year, month, day };
}

function parseTimeInput(value: string) {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  return { hour, minute };
}

export function resolveCalendarTimeZone(timeZone?: string | null): string {
  if (!timeZone) return "local";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "local";
  }
}

export function toTimeZoneDateInputValue(
  isoString: string,
  timeZone?: string | null,
) {
  const resolved = resolveCalendarTimeZone(timeZone);
  if (resolved === "local") {
    const date = new Date(isoString);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 10);
  }

  const parts = getDateTimeParts(new Date(isoString), resolved);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function toTimeZoneTimeInputValue(
  isoString: string,
  timeZone?: string | null,
) {
  const resolved = resolveCalendarTimeZone(timeZone);
  if (resolved === "local") {
    const date = new Date(isoString);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  const parts = getDateTimeParts(new Date(isoString), resolved);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function fromTimeZoneDateTimeToIso(
  dateInput: string,
  timeInput: string,
  timeZone?: string | null,
) {
  const resolved = resolveCalendarTimeZone(timeZone);
  if (resolved === "local") {
    return new Date(`${dateInput}T${timeInput}:00`).toISOString();
  }

  const { year, month, day } = parseDateInput(dateInput);
  const { hour, minute } = parseTimeInput(timeInput);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  let offset = getOffsetMs(new Date(utcGuess), resolved);
  let timestamp = utcGuess - offset;
  const nextOffset = getOffsetMs(new Date(timestamp), resolved);
  if (nextOffset !== offset) {
    timestamp = utcGuess - nextOffset;
    offset = nextOffset;
  }

  const finalOffset = getOffsetMs(new Date(timestamp), resolved);
  if (finalOffset !== offset) {
    timestamp = utcGuess - finalOffset;
  }

  return new Date(timestamp).toISOString();
}

export function fromTimeZoneDateToIso(
  dateInput: string,
  timeZone?: string | null,
  endOfDay = false,
) {
  return fromTimeZoneDateTimeToIso(
    dateInput,
    endOfDay ? "23:59" : "00:00",
    timeZone,
  );
}

export function formatDateInTimeZone(
  value: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: resolveCalendarTimeZone(timeZone),
  }).format(date);
}
