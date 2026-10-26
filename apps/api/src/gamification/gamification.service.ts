import { Injectable } from '@nestjs/common';
import { GameService } from '../game/game.service';

/**
 * Legacy endpoints of the old XP profile. XP now lives in the activity
 * ledger of the game (see GameService); "record activity" no longer awards
 * anything, so it cannot be farmed.
 */
@Injectable()
export class GamificationService {
  constructor(private readonly game: GameService) {}

  getProfile(userId: string) {
    return this.game.legacyProfile(userId);
  }

  recordActivity(userId: string) {
    return this.game.legacyProfile(userId);
  }
}
