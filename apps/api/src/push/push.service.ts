import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sendWebPush, type VapidKeys } from './web-push';

/** Kinds of push messages; each can be switched off per user. */
export const PUSH_KINDS = {
  assignments: { label: 'New missions from your coach', default: true },
  reviews: { label: 'Coach reviews of your missions', default: true },
  schedule: { label: 'Training changes and answer reminders', default: true },
  streak: { label: 'Weekly goal reminder', default: true },
  team: { label: 'Kudos, challenges and league', default: true },
  messages: { label: 'New chat messages', default: false },
  mentions: {
    label: 'Mentions and handover notes from other coaches',
    default: true,
  },
  activity: { label: 'Missions completed by your players', default: false },
} as const;
export type PushKind = keyof typeof PUSH_KINDS;
const PLAYER_ONLY: PushKind[] = ['assignments', 'reviews', 'streak', 'team'];
const COACH_ONLY: PushKind[] = ['activity', 'mentions'];

export type PushMessage = {
  title: string;
  body: string;
  /** Path inside the app that opens on tap. */
  url?: string;
  /** Same tag replaces an older notification on the device. */
  tag?: string;
};

function vapidKeys(): VapidKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject:
      process.env.VAPID_SUBJECT?.trim() ||
      'mailto:info@golf-challengepoint.com',
  };
}

export function resolvePrefs(stored: unknown) {
  const raw =
    stored && typeof stored === 'object'
      ? (stored as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    (Object.keys(PUSH_KINDS) as PushKind[]).map((kind) => [
      kind,
      typeof raw[kind] === 'boolean' ? raw[kind] : PUSH_KINDS[kind].default,
    ]),
  ) as Record<PushKind, boolean>;
}

/** Web push to the user's devices (iPhone: only for the app added to the home screen). */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  config() {
    const keys = vapidKeys();
    return { enabled: Boolean(keys), publicKey: keys?.publicKey ?? null };
  }

  async subscribe(
    userId: string,
    body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } },
    userAgent?: string,
  ) {
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    if (
      typeof endpoint !== 'string' ||
      !/^https:\/\//.test(endpoint) ||
      endpoint.length > 1000 ||
      typeof p256dh !== 'string' ||
      typeof auth !== 'string' ||
      p256dh.length > 200 ||
      auth.length > 100
    ) {
      throw new BadRequestException('Invalid push subscription');
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
      update: {
        userId,
        p256dh,
        auth,
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: unknown) {
    if (typeof endpoint !== 'string')
      throw new BadRequestException('endpoint is required');
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { subscribed: false };
  }

  async prefs(userId: string) {
    const [user, devices] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPrefs: true, role: true },
      }),
      this.prisma.pushSubscription.count({ where: { userId } }),
    ]);
    return {
      ...this.config(),
      devices,
      prefs: resolvePrefs(user?.notificationPrefs),
      kinds: Object.entries(PUSH_KINDS)
        .filter(([key]) =>
          user?.role === 'PLAYER'
            ? !COACH_ONLY.includes(key as PushKind)
            : !PLAYER_ONLY.includes(key as PushKind),
        )
        .map(([key, value]) => ({ key, label: value.label })),
    };
  }

  async updatePrefs(userId: string, body: Record<string, unknown>) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    const next = resolvePrefs(user?.notificationPrefs);
    for (const kind of Object.keys(PUSH_KINDS) as PushKind[]) {
      const value = body?.[kind];
      if (typeof value === 'boolean') next[kind] = value;
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: next },
    });
    return this.prefs(userId);
  }

  async test(userId: string) {
    const sent = await this.send([userId], null, {
      title: 'Golf ChallengePoint',
      body: 'Push notifications work on this device. ⛳',
      url: '/dashboard',
      tag: 'test',
    });
    return { sent };
  }

  /** Fire and forget: never throws, logs failures. */
  notify(userIds: string[], kind: PushKind, message: PushMessage) {
    void this.send(userIds, kind, message).catch((err: unknown) =>
      this.logger.warn(
        `Push failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  private async send(
    userIds: string[],
    kind: PushKind | null,
    message: PushMessage,
  ) {
    const keys = vapidKeys();
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!keys || ids.length === 0) return 0;
    let recipients = ids;
    if (kind) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, notificationPrefs: true },
      });
      recipients = users
        .filter((user) => resolvePrefs(user.notificationPrefs)[kind])
        .map((user) => user.id);
    }
    if (recipients.length === 0) return 0;
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: recipients } },
    });
    let sent = 0;
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          const status = await sendWebPush(
            subscription,
            {
              title: message.title,
              body: message.body.slice(0, 240),
              url: message.url ?? '/dashboard',
              tag: message.tag,
            },
            keys,
            { topic: message.tag },
          );
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: subscription.id } })
              .catch(() => null);
          } else if (status >= 200 && status < 300) {
            sent += 1;
            await this.prisma.pushSubscription
              .update({
                where: { id: subscription.id },
                data: { lastUsedAt: new Date() },
              })
              .catch(() => null);
          } else {
            this.logger.warn(`Push service answered ${status}`);
          }
        } catch (err) {
          this.logger.warn(
            `Push error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );
    return sent;
  }
}
