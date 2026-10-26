/**
 * Injection tokens for the game and push hooks used by other services.
 * This file must not import the Prisma client, so services that are unit
 * tested without a database can depend on it.
 */
export const GAME_HOOKS = 'GAME_HOOKS';
export const PUSH_HOOKS = 'PUSH_HOOKS';

export type PushKindName =
  | 'assignments'
  | 'reviews'
  | 'schedule'
  | 'streak'
  | 'team'
  | 'messages'
  | 'activity'
  | 'mentions';

export type PushNote = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export interface PushHooks {
  notify(userIds: string[], kind: PushKindName, message: PushNote): void;
}

export interface GameHooks extends PushHooks {
  /** Re-derive XP, badges … for the player (fire and forget). */
  syncQuietly(playerId: string | null | undefined): void;
  /** "New mission/journey from <coach>" push. */
  notifyNewWork(
    coachId: string,
    target: { playerIds?: string[]; teamId?: string },
    work: { lessonId?: string; journeyId?: string },
  ): void;
}
