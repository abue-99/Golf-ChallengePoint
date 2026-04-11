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
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listAll(@CurrentUser() caller: AuthenticatedUser) {
    if (caller.role === 'ADMIN') {
      return this.usersService.listForAdmin(caller.id);
    }
    return this.usersService.listAll();
  }

  @Patch(':id/role')
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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
