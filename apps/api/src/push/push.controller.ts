import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  /** GET /push – settings, public key and number of devices. */
  @Get()
  prefs(@CurrentUser() user: AuthenticatedUser) {
    return this.push.prefs(user.id);
  }

  /** PATCH /push – { assignments?: boolean, reviews?: boolean, … } */
  @Patch()
  updatePrefs(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.push.updatePrefs(user.id, body);
  }

  /** POST /push/subscribe – PushSubscription.toJSON() of the browser. */
  @Post('subscribe')
  subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } },
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.push.subscribe(user.id, body, userAgent);
  }

  /** POST /push/unsubscribe – { endpoint } */
  @Post('unsubscribe')
  unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { endpoint?: unknown },
  ) {
    return this.push.unsubscribe(user.id, body?.endpoint);
  }

  /** POST /push/test – sends a test notification to all own devices. */
  @Post('test')
  test(@CurrentUser() user: AuthenticatedUser) {
    return this.push.test(user.id);
  }
}
