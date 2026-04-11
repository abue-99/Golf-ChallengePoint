import {
  Controller,
  Get,
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
  listAll() {
    return this.usersService.listAll();
  }

  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() body: { role: 'PLAYER' | 'COACH' | 'ADMIN' | 'SYSADMIN' },
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    // ADMIN-level callers may only assign PLAYER or COACH.
    // SYSADMIN can assign any role.
    if (caller.role !== 'SYSADMIN' && !['PLAYER', 'COACH'].includes(body.role)) {
      throw new ForbiddenException('Admins can only assign the Player or Coach role.');
    }
    return this.usersService.updateRole(id, body.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
