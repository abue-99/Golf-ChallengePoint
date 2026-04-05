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

  $transaction<T>(...args: Parameters<PrismaClient['$transaction']>): Promise<T> {
    return this.client.$transaction(...(args as [Parameters<PrismaClient['$transaction']>[0]])) as Promise<T>;
  }
}
