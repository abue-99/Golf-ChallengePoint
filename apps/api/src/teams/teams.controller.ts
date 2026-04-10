import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  private requireCoach(user: AuthenticatedUser) {
    if ((user.role as string) !== 'COACH') throw new ForbiddenException('Only coaches can manage teams');
  }

  @Get()
  getMyTeams(@CurrentUser() user: AuthenticatedUser) {
    this.requireCoach(user);
    return this.teamsService.getCoachTeams(user.id);
  }

  @Get('categories')
  getCategories(@CurrentUser() user: AuthenticatedUser) {
    this.requireCoach(user);
    return this.teamsService.getCoachCategories(user.id);
  }

  @Get('club-players')
  getClubPlayers(@CurrentUser() user: AuthenticatedUser) {
    this.requireCoach(user);
    return this.teamsService.getClubPlayers(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { shortName: string; description: string; category: string },
  ) {
    this.requireCoach(user);
    return this.teamsService.createTeam(user.id, body);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  updateTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { shortName?: string; description?: string; category?: string },
  ) {
    this.requireCoach(user);
    return this.teamsService.updateTeam(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    this.requireCoach(user);
    return this.teamsService.deleteTeam(user.id, id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    this.requireCoach(user);
    return this.teamsService.addMember(user.id, id, body.userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    this.requireCoach(user);
    return this.teamsService.removeMember(user.id, id, userId);
  }
}
