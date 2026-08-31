'use client';

interface GamificationStatsProps {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
}

export function GamificationStats({ xp, level, currentStreak, longestStreak }: GamificationStatsProps) {
  return (
    <div className="flex gap-4 items-center rounded-lg border p-4">
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Level</p>
        <p className="text-2xl font-bold">{level}</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">XP</p>
        <p className="text-2xl font-bold">{xp}</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Streak</p>
        <p className="text-2xl font-bold">{currentStreak}</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Best Streak</p>
        <p className="text-2xl font-bold">{longestStreak}</p>
      </div>
    </div>
  );
}
