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
} from '@nestjs/common';
import { Role } from '@challengepoint/db';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ClubsService, ClubDto } from './clubs.service';

@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  listAll() {
    return this.clubsService.listAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  createClub(@Body() body: ClubDto) {
    return this.clubsService.createClub(body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateClub(@Param('id') id: string, @Body() body: Partial<ClubDto>) {
    return this.clubsService.updateClub(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  deleteClub(@Param('id') id: string) {
    return this.clubsService.deleteClub(id);
  }

  @Get('my')
  getMyClubs(@CurrentUser() user: AuthenticatedUser) {
    return this.clubsService.getUserClubs(user.id);
  }

  @Post('my')
  @HttpCode(HttpStatus.OK)
  addClub(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { clubId: string },
  ) {
    return this.clubsService.addUserClub(user.id, body.clubId);
  }

  @Delete('my/:clubId')
  @HttpCode(HttpStatus.OK)
  removeClub(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ) {
    return this.clubsService.removeUserClub(user.id, clubId);
  }
}
