import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { RosterService } from './roster.service';

@Controller('coach/roster')
@UseGuards(JwtAuthGuard)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  /** GET /coach/roster?tz=Europe/Berlin – the coach home page in one call. */
  @Get()
  getRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tz') timeZone?: string,
  ) {
    const role = user.role as string;
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches and admins have a roster');
    }
    return this.rosterService.getRoster(user.id, timeZone);
  }
}
