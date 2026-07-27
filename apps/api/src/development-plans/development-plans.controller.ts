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
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { DevelopmentPlansService } from './development-plans.service';

@Controller('development-plans')
@UseGuards(JwtAuthGuard)
export class DevelopmentPlansController {
  constructor(private readonly service: DevelopmentPlansService) {}

  // ─── Plans ────────────────────────────────────────────────────────────────

  /** List all plans for a given player (coach/admin access) */
  @Get('player/:playerId')
  listPlansForPlayer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('playerId') playerId: string,
  ) {
    // Players can view their own plans
    if (user.role === 'PLAYER') {
      return this.service.getPlayerPlansAsPlayer(user.id);
    }
    return this.service.listPlansForPlayer(user.id, user.role as string, playerId);
  }

  /** Player retrieves their own plans */
  @Get('my-plans')
  getMyPlans(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getPlayerPlansAsPlayer(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { playerId: string; name: string; description?: string; startDate?: string; endDate?: string },
  ) {
    return this.service.createPlan(user.id, user.role as string, body);
  }

  @Patch(':id')
  updatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; startDate?: string | null; endDate?: string | null },
  ) {
    return this.service.updatePlan(user.id, user.role as string, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deletePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deletePlan(user.id, user.role as string, id);
  }

  // ─── Training Blocks ──────────────────────────────────────────────────────

  @Post(':planId/blocks')
  @HttpCode(HttpStatus.CREATED)
  createBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') planId: string,
    @Body() body: { name: string; description?: string; goal?: string; startDate?: string; endDate?: string; sortOrder?: number },
  ) {
    return this.service.createBlock(user.id, user.role as string, planId, body);
  }

  @Patch('blocks/:blockId')
  updateBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('blockId') blockId: string,
    @Body() body: { name?: string; description?: string; goal?: string; startDate?: string | null; endDate?: string | null; sortOrder?: number },
  ) {
    return this.service.updateBlock(user.id, user.role as string, blockId, body);
  }

  @Delete('blocks/:blockId')
  @HttpCode(HttpStatus.OK)
  deleteBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('blockId') blockId: string,
  ) {
    return this.service.deleteBlock(user.id, user.role as string, blockId);
  }

  // ─── Lesson Assignments ───────────────────────────────────────────────────

  @Post('blocks/:blockId/assignments')
  @HttpCode(HttpStatus.CREATED)
  addAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('blockId') blockId: string,
    @Body() body: { lessonId: string; playerId: string; dueDate?: string; priority?: string; sortOrder?: number },
  ) {
    return this.service.addAssignment(user.id, user.role as string, blockId, body);
  }

  @Patch('assignments/:assignmentId')
  updateAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
    @Body() body: {
      status?: string;
      dueDate?: string | null;
      priority?: string;
      sortOrder?: number;
      playerNotes?: string;
      selfAssessment?: number | null;
    },
  ) {
    return this.service.updateAssignment(user.id, user.role as string, assignmentId, body);
  }

  @Delete('assignments/:assignmentId')
  @HttpCode(HttpStatus.OK)
  removeAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.service.removeAssignment(user.id, user.role as string, assignmentId);
  }
}
