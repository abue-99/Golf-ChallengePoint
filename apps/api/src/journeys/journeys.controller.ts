import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { JourneysService } from './journeys.service';

@Controller('journeys')
@UseGuards(JwtAuthGuard)
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Get()
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.journeysService.listTemplates(user.id, user.role as string);
  }

  @Get(':id')
  getTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.journeysService.getTemplate(user.id, user.role as string, id);
  }

  @Post()
  createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      name: string;
      description?: string | null;
      category?: string | null;
      difficulty?: string | null;
      coverImageUrl?: string | null;
      lessons?: {
        lessonId: string;
        sortOrder?: number;
        isRequired?: boolean;
      }[];
    },
  ) {
    return this.journeysService.createTemplate(
      user.id,
      user.role as string,
      body,
    );
  }

  @Patch(':id')
  updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      category?: string | null;
      difficulty?: string | null;
      coverImageUrl?: string | null;
      lessons?: {
        lessonId: string;
        sortOrder?: number;
        isRequired?: boolean;
      }[];
    },
  ) {
    return this.journeysService.updateTemplate(
      user.id,
      user.role as string,
      id,
      body,
    );
  }

  @Delete(':id')
  deleteTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.journeysService.deleteTemplate(
      user.id,
      user.role as string,
      id,
    );
  }

  @Post(':id/duplicate')
  duplicateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.journeysService.duplicateTemplate(
      user.id,
      user.role as string,
      id,
    );
  }

  @Patch('assignments/:assignmentId')
  updateJourneyAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
    @Body() body: { status?: string; isInTrainingQueue?: boolean },
  ) {
    return this.journeysService.updateJourneyAssignment(
      user.id,
      user.role as string,
      assignmentId,
      body,
    );
  }
}
