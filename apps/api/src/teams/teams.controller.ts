import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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

  private requireCoachOrAdmin(user: AuthenticatedUser) {
    const role = user.role as string;
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches and admins can manage teams');
    }
  }

  @Get()
  getMyTeams(@CurrentUser() user: AuthenticatedUser) {
    this.requireCoachOrAdmin(user);
    return this.teamsService.getCoachTeams(user.id);
  }

  @Get('categories')
  getCategories(@CurrentUser() user: AuthenticatedUser) {
    this.requireCoachOrAdmin(user);
    return this.teamsService.getCoachCategories(user.id);
  }

  @Get('club-players')
  getClubPlayers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clubId') clubId?: string,
  ) {
    this.requireCoachOrAdmin(user);
    return this.teamsService.getClubUsers(user.id, clubId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      icon?: string;
      shortName: string;
      description?: string;
      category?: string;
      clubId?: string;
    },
  ) {
    this.requireCoachOrAdmin(user);
    return this.teamsService.createTeam(user.id, body);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  updateTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      icon?: string;
      shortName?: string;
      description?: string;
      category?: string;
      clubId?: string | null;
    },
  ) {
    this.requireCoachOrAdmin(user);
    return this.teamsService.updateTeam(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    this.requireCoachOrAdmin(user);
    return this.teamsService.deleteTeam(user.id, id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    this.requireCoachOrAdmin(user);
    return this.teamsService.addMember(user.id, id, body.userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    this.requireCoachOrAdmin(user);
    return this.teamsService.removeMember(user.id, id, userId);
  }
}
