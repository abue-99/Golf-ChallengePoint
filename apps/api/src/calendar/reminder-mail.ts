import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

const FROM = 'noreply@contact.golf-challengepoint.com';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function appUrl() {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

/** "Tue 27 Oct, 16:00–18:00" in the player's time zone. */
export function formatSession(start: Date, end: Date, timeZone: string) {
  const safeZone = (() => {
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone });
      return timeZone;
    } catch {
      return 'Europe/Berlin';
    }
  })();
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(start);
  const time = (date: Date) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: safeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  return `${day}, ${time(start)}–${time(end)}`;
}

export type ReminderMailInput = {
  firstName: string | null;
  coachName: string | null;
  title: string;
  teamName: string;
  when: string;
  location: string | null;
  url: string;
};

/** Subject, HTML and text of the "are you coming?" reminder. */
export function buildReminderMail(input: ReminderMailInput) {
  const subject = `Are you coming? ${input.title} – ${input.when}`;
  const greeting = input.firstName ? `Hi ${input.firstName},` : 'Hi,';
  const asker = input.coachName
    ? `${input.coachName} would like to know`
    : 'Your coach would like to know';
  const lines = [
    `${asker} whether you are coming to ${input.title} (${input.teamName}).`,
    `When: ${input.when}`,
    input.location ? `Where: ${input.location}` : null,
  ].filter((line): line is string => Boolean(line));
  const text = [
    greeting,
    '',
    ...lines,
    '',
    `Answer in the app: ${input.url}`,
  ].join('\n');
  const html = `
    <p>${escapeHtml(greeting)}</p>
    ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n    ')}
    <p><a href="${escapeHtml(input.url)}">Answer in Golf Challenge Point</a></p>
    <p style="color:#64748b;font-size:12px">You get this e-mail because you have not answered yet.</p>
  `;
  return { subject, html, text };
}

/** Thin wrapper so tests can replace e-mail delivery. */
@Injectable()
export class ReminderMailer {
  private readonly logger = new Logger(ReminderMailer.name);
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  /** Returns true when the e-mail was handed to the provider. */
  async send(mail: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(
        `[REMINDER] RESEND_API_KEY not set – skipping e-mail to ${mail.to}`,
      );
      return false;
    }
    try {
      const result = await this.resend.emails.send({ from: FROM, ...mail });
      if (result.error) {
        this.logger.error(
          `Reminder to ${mail.to} failed: ${result.error.message}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Reminder to ${mail.to} failed: ${String(err)}`);
      return false;
    }
  }
}
