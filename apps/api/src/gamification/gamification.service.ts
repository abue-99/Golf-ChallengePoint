import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const XP_PER_ACTIVITY = 10;

function xpToLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

function profileProgress(xp: number) {
  return {
    level: xpToLevel(xp),
    levelProgress: xp % 100,
    nextLevelXp: 100,
  };
}

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId },
      select: {
        xp: true,
        level: true,
        currentStreak: true,
        longestStreak: true,
        lastActivityAt: true,
      },
    });
    if (!profile) return null;
    return {
      ...profile,
      ...profileProgress(profile.xp),
    };
  }

  async recordActivity(userId: string): Promise<{
    xp: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    levelProgress: number;
    nextLevelXp: number;
  }> {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new Error('Player profile not found');

    const now = new Date();
    const lastActivity = profile.lastActivityAt;
    const oneDayMs = 86_400_000;
    let currentStreak = profile.currentStreak;

    if (lastActivity) {
      const diff = now.getTime() - lastActivity.getTime();
      if (diff >= oneDayMs && diff < oneDayMs * 2) {
        currentStreak += 1;
      } else if (diff < oneDayMs) {
        // same day activity — keep streak unchanged
      } else {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }

    const longestStreak = Math.max(profile.longestStreak, currentStreak);
    const xp = profile.xp + XP_PER_ACTIVITY + currentStreak;
    const level = xpToLevel(xp);

    const updated = await this.prisma.playerProfile.update({
      where: { userId },
      data: { xp, level, currentStreak, longestStreak, lastActivityAt: now },
      select: {
        xp: true,
        level: true,
        currentStreak: true,
        longestStreak: true,
      },
    });

    return {
      ...updated,
      ...profileProgress(updated.xp),
    };
  }
}
