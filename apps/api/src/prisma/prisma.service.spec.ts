import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

jest.mock('@challengepoint/db', () => ({
  prisma: {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    playerProfile: { findUnique: jest.fn() },
    coachPlayerLink: { findMany: jest.fn() },
    taskTemplate: { findMany: jest.fn() },
    passwordResetToken: { findUnique: jest.fn() },
  },
}));

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to the database', async () => {
      const { prisma } = await import('@challengepoint/db');
      await service.onModuleInit();
      expect(prisma.$connect).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from the database', async () => {
      const { prisma } = await import('@challengepoint/db');
      await service.onModuleDestroy();
      expect(prisma.$disconnect).toHaveBeenCalled();
    });
  });

  describe('property proxies', () => {
    it('should expose the user model', () => {
      expect(service.user).toBeDefined();
    });

    it('should expose the playerProfile model', () => {
      expect(service.playerProfile).toBeDefined();
    });

    it('should expose the coachPlayerLink model', () => {
      expect(service.coachPlayerLink).toBeDefined();
    });

    it('should expose the taskTemplate model', () => {
      expect(service.taskTemplate).toBeDefined();
    });

    it('should expose the passwordResetToken model', () => {
      expect(service.passwordResetToken).toBeDefined();
    });
  });

  describe('$transaction', () => {
    it('should delegate to the prisma client $transaction', async () => {
      const { prisma } = await import('@challengepoint/db');
      const callback = jest.fn().mockResolvedValue('result');
      const transactionMock = jest.fn().mockResolvedValue('result');
      (prisma as any).$transaction = transactionMock;

      await service.$transaction(callback);

      expect(transactionMock).toHaveBeenCalledWith(callback);
    });
  });
});
