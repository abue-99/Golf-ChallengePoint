import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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
import { TeamStaffService } from './team-staff.service';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly staff: TeamStaffService,
  ) {}

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

  @Get(':id')
  getTeam(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.requireCoachOrAdmin(user);
    return this.teamsService.getTeamById(user.id, id);
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
  deleteTeam(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
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

  // ── Coaching staff ─────────────────────────────────────────────────────

  @Get(':id/staff')
  listStaff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.requireCoachOrAdmin(user);
    return this.staff.list(user.id, user.role as string, id);
  }

  @Get(':id/staff/candidates')
  staffCandidates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    this.requireCoachOrAdmin(user);
    return this.staff.candidates(user.id, user.role as string, id);
  }

  @Post(':id/staff')
  @HttpCode(HttpStatus.OK)
  addStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { coachId?: unknown; role?: unknown },
  ) {
    this.requireCoachOrAdmin(user);
    return this.staff.add(user.id, user.role as string, id, body ?? {});
  }

  @Post(':id/staff/head')
  @HttpCode(HttpStatus.OK)
  transferHead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { coachId?: unknown },
  ) {
    this.requireCoachOrAdmin(user);
    return this.staff.transferHead(
      user.id,
      user.role as string,
      id,
      body?.coachId,
    );
  }

  @Put(':id/staff/:coachId')
  changeStaffRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('coachId') coachId: string,
    @Body() body: { role?: unknown },
  ) {
    this.requireCoachOrAdmin(user);
    return this.staff.changeRole(
      user.id,
      user.role as string,
      id,
      coachId,
      body?.role,
    );
  }

  @Delete(':id/staff/:coachId')
  @HttpCode(HttpStatus.OK)
  removeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('coachId') coachId: string,
  ) {
    this.requireCoachOrAdmin(user);
    return this.staff.remove(user.id, user.role as string, id, coachId);
  }
}
