import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ClubsService } from './clubs.service';

@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  listAll() {
    return this.clubsService.listAll();
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
