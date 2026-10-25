import { BadRequestException, ForbiddenException } from '@nestjs/common';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
const canSee = jest.fn(() => Promise.resolve(true));
jest.mock('../teams/team-access', () => ({
  coachCanSeePlayer: (...args: unknown[]) =>
    (canSee as (...a: unknown[]) => Promise<boolean>)(...args),
  coachTeamsWhere: () => ({}),
}));

import { cleanBody, MessagesService, openQuestionOf } from './messages.service';

const users: Record<string, { id: string; role: string }> = {
  coach: { id: 'coach', role: 'COACH' },
  max: { id: 'max', role: 'PLAYER' },
  other: { id: 'other', role: 'PLAYER' },
};

function setup() {
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          users[where.id]
            ? {
                ...users[where.id],
                firstName: where.id,
                lastName: null,
                email: `${where.id}@test.de`,
                profileImage: null,
              }
            : null,
        ),
      ),
    },
    conversation: {
      upsert: jest.fn().mockResolvedValue({ id: 'c1' }),
    },
    message: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'm1', ...data }),
      ),
    },
  };
  return { prisma, service: new MessagesService(prisma as never) };
}

describe('cleanBody', () => {
  it('trims and limits the text', () => {
    expect(cleanBody('  Hi Max  ')).toBe('Hi Max');
    expect(() => cleanBody('   ')).toThrow(BadRequestException);
    expect(() => cleanBody('x'.repeat(2001))).toThrow(BadRequestException);
    expect(() => cleanBody(42)).toThrow(BadRequestException);
  });
});

describe('openQuestionOf', () => {
  const question = {
    id: 'q',
    body: 'How did the round go?',
    createdAt: new Date('2030-01-01T10:00:00Z'),
  };
  it('is open until the player writes after it', () => {
    expect(openQuestionOf(question, null)).toBe(question);
    expect(openQuestionOf(question, new Date('2030-01-01T09:00:00Z'))).toBe(
      question,
    );
    expect(
      openQuestionOf(question, new Date('2030-01-01T11:00:00Z')),
    ).toBeNull();
    expect(openQuestionOf(null, null)).toBeNull();
  });
});

describe('MessagesService.send', () => {
  beforeEach(() => canSee.mockResolvedValue(true));

  it('creates the conversation and keeps questions for coaches only', async () => {
    const { prisma, service } = setup();
    await service.send('coach', 'COACH', 'max', {
      body: 'Did you practise?',
      isQuestion: true,
    });
    expect(prisma.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { coachId_playerId: { coachId: 'coach', playerId: 'max' } },
      }),
    );
    expect(prisma.message.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isQuestion: true }) as unknown,
      }),
    );
    await service.send('max', 'PLAYER', 'coach', {
      body: 'Yes!',
      isQuestion: true,
    });
    expect(prisma.message.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isQuestion: false }) as unknown,
      }),
    );
  });

  it('refuses people who do not work together', async () => {
    const { service } = setup();
    canSee.mockResolvedValue(false);
    await expect(
      service.send('coach', 'COACH', 'other', { body: 'Hi' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a player writing to a player', async () => {
    const { service } = setup();
    await expect(
      service.send('max', 'PLAYER', 'other', { body: 'Hi' }),
    ).rejects.toThrow();
  });
});
