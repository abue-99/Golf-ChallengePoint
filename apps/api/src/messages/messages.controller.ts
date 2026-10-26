import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { MessagesService } from './messages.service';

/** 1:1 messages between coaches and players. */
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  /** GET /messages – conversations and people to write to. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.messages.list(user.id, user.role as string);
  }

  /** GET /messages/unread – { total, byUser } for badges. */
  @Get('unread')
  unread(@CurrentUser() user: AuthenticatedUser) {
    return this.messages.unread(user.id, user.role as string);
  }

  /** GET /messages/with/:userId?after=&before= – the thread (marks it read). */
  @Get('with/:userId')
  thread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Query('after') after?: string,
    @Query('before') before?: string,
  ) {
    return this.messages.thread(user.id, user.role as string, userId, {
      after,
      before,
    });
  }

  /** POST /messages/with/:userId – { body, isQuestion?, ref?: { type, id } }; userId may be "team:<id>". */
  @Post('with/:userId')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: { body?: unknown; isQuestion?: unknown; ref?: unknown },
  ) {
    return this.messages.send(user.id, user.role as string, userId, body ?? {});
  }
}
