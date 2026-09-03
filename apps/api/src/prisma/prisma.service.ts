import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { prisma, PrismaClient } from '@challengepoint/db';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient = prisma;

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  // Proxy all property access to the prisma client
  get user() {
    return this.client.user;
  }

  get playerProfile() {
    return this.client.playerProfile;
  }

  get coachPlayerLink() {
    return this.client.coachPlayerLink;
  }

  get taskTemplate() {
    return this.client.taskTemplate;
  }

  get passwordResetToken() {
    return this.client.passwordResetToken;
  }

  get club() {
    return this.client.club;
  }

  get userClub() {
    return this.client.userClub;
  }

  get team() {
    return this.client.team;
  }

  get teamMember() {
    return this.client.teamMember;
  }

  get practiceSlot() {
    return this.client.practiceSlot;
  }

  get calendarTask() {
    return this.client.calendarTask;
  }

  get availabilityBlock() {
    return this.client.availabilityBlock;
  }

  get teamEvent() {
    return this.client.teamEvent;
  }

  get tournament() {
    return this.client.tournament;
  }

  get trainingLesson() {
    return this.client.trainingLesson;
  }

  get playerDevelopmentPlan() {
    return this.client.playerDevelopmentPlan;
  }

  get trainingBlock() {
    return this.client.trainingBlock;
  }

  get lessonAssignment() {
    return this.client.lessonAssignment;
  }

  get journeyTemplate() {
    return this.client.journeyTemplate;
  }

  get journeyTemplateLesson() {
    return this.client.journeyTemplateLesson;
  }

  get journeyTemplateAssignment() {
    return this.client.journeyTemplateAssignment;
  }

  get developmentPlanMilestone() {
    return this.client.developmentPlanMilestone;
  }

  $transaction<T>(
    ...args: Parameters<PrismaClient['$transaction']>
  ): Promise<T> {
    return this.client.$transaction(...args) as Promise<T>;
  }
}
