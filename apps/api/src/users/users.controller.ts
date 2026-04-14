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
import { Role } from '@challengepoint/db';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  listAll(@CurrentUser() caller: AuthenticatedUser) {
    if (caller.role === 'ADMIN') {
      return this.usersService.listForAdmin(caller.id);
    }
    return this.usersService.listAll();
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  updateRole(
    @Param('id') id: string,
    @Body() body: { role: 'PLAYER' | 'COACH' | 'ADMIN' | 'SYSADMIN' },
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    // SYSADMINs can assign any role.
    // ADMINs may only assign COACH or ADMIN.
    if (caller.role !== 'SYSADMIN' && !['COACH', 'ADMIN'].includes(body.role)) {
      throw new ForbiddenException(
        `ADMINs can only assign the Coach or Admin role, not ${body.role}.`,
      );
    }
    return this.usersService.updateRole(id, body.role);
  }

  @Patch(':id/profile')
  @Roles(Role.ADMIN)
  updateProfile(
    @Param('id') id: string,
    @Body() body: { firstName?: string | null; lastName?: string | null },
  ) {
    return this.usersService.updateProfile(id, body);
  }

  @Post(':id/clubs')
  @Roles(Role.SYSADMIN)
  addUserClub(
    @Param('id') id: string,
    @Body() body: { clubId: string },
  ) {
    return this.usersService.addUserClub(id, body.clubId);
  }

  @Delete(':id/clubs/:clubId')
  @Roles(Role.SYSADMIN)
  @HttpCode(HttpStatus.OK)
  removeUserClub(
    @Param('id') id: string,
    @Param('clubId') clubId: string,
  ) {
    return this.usersService.removeUserClub(id, clubId);
  }

  @Get(':id/coaches')
  @Roles(Role.SYSADMIN)
  getUserCoaches(@Param('id') id: string) {
    return this.usersService.getPlayerCoaches(id);
  }

  @Get(':id/available-coaches')
  @Roles(Role.SYSADMIN)
  getAvailableCoachesForUser(@Param('id') id: string) {
    return this.usersService.getCoachesForUser(id);
  }

  @Post(':id/coaches/:coachId')
  @Roles(Role.SYSADMIN)
  @HttpCode(HttpStatus.OK)
  addCoachToUser(
    @Param('id') id: string,
    @Param('coachId') coachId: string,
  ) {
    return this.usersService.addPlayerCoach(id, coachId);
  }

  @Delete(':id/coaches/:coachId')
  @Roles(Role.SYSADMIN)
  @HttpCode(HttpStatus.OK)
  removeCoachFromUser(
    @Param('id') id: string,
    @Param('coachId') coachId: string,
  ) {
    return this.usersService.removePlayerCoach(id, coachId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  /** Invite a new player (COACH or ADMIN only). */
  @Post('invite')
  @Roles(Role.COACH)
  @HttpCode(HttpStatus.CREATED)
  invitePlayer(
    @CurrentUser() caller: AuthenticatedUser,
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      clubId: string;
    },
  ) {
    return this.usersService.invitePlayer({
      ...body,
      coachId: caller.id,
    });
  }

  /** Get players linked to the current coach/admin. */
  @Get('me/players')
  getMyPlayers(@CurrentUser() caller: AuthenticatedUser) {
    return this.usersService.getCoachPlayers(caller.id);
  }

  /** Get coaches available to the current user (from shared clubs). */
  @Get('me/available-coaches')
  getAvailableCoaches(@CurrentUser() caller: AuthenticatedUser) {
    return this.usersService.getCoachesForUser(caller.id);
  }

  /** Get coaches currently linked to the current user. */
  @Get('me/coaches')
  getMyCoaches(@CurrentUser() caller: AuthenticatedUser) {
    return this.usersService.getPlayerCoaches(caller.id);
  }

  /** Link a coach to the current user. */
  @Post('me/coaches/:coachId')
  @HttpCode(HttpStatus.OK)
  addMyCoach(
    @CurrentUser() caller: AuthenticatedUser,
    @Param('coachId') coachId: string,
  ) {
    return this.usersService.addPlayerCoach(caller.id, coachId);
  }

  /** Unlink a coach from the current user. */
  @Delete('me/coaches/:coachId')
  @HttpCode(HttpStatus.OK)
  removeMyCoach(
    @CurrentUser() caller: AuthenticatedUser,
    @Param('coachId') coachId: string,
  ) {
    return this.usersService.removePlayerCoach(caller.id, coachId);
  }

  /** Resend the invitation email to a user who has not yet logged in. */
  @Post(':id/resend-invite')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  resendInvite(@Param('id') id: string) {
    return this.usersService.resendInvite(id);
  }

  /** Link an existing player to the current coach. */
  @Post('me/players/:playerId')
  @Roles(Role.COACH)
  @HttpCode(HttpStatus.OK)
  addMyPlayer(
    @CurrentUser() caller: AuthenticatedUser,
    @Param('playerId') playerId: string,
  ) {
    return this.usersService.addPlayerToCoach(caller.id, playerId);
  }

  /** Unlink a player from the current coach. */
  @Delete('me/players/:playerId')
  @Roles(Role.COACH)
  @HttpCode(HttpStatus.OK)
  removeMyPlayer(
    @CurrentUser() caller: AuthenticatedUser,
    @Param('playerId') playerId: string,
  ) {
    return this.usersService.removePlayerFromCoach(caller.id, playerId);
  }
}
