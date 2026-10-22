import { BadRequestException } from '@nestjs/common';
import { PasswordResetService, hashResetToken } from './password-reset.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PasswordResetService', () => {
  const tx = {
    passwordResetToken: { deleteMany: jest.fn(), create: jest.fn() },
    user: { update: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    passwordResetToken: { findUnique: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  let service: PasswordResetService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    service = new PasswordResetService(prisma as unknown as PrismaService);
  });

  it('does nothing for unknown emails', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await service.requestReset('nobody@test.dev');
    expect(tx.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('stores only a hash and replaces older tokens', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', firstName: 'A' });
    await service.requestReset('A@Test.dev ');
    expect(tx.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { email: 'a@test.dev' },
    });
    const data = tx.passwordResetToken.create.mock.calls[0][0].data;
    expect(data.email).toBe('a@test.dev');
    expect(data.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rate-limits repeated requests per email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    for (let i = 0; i < 5; i++) await service.requestReset('a@test.dev');
    expect(tx.passwordResetToken.create).toHaveBeenCalledTimes(3);
  });

  it('rejects unknown or expired tokens', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      email: 'a@test.dev',
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(
      service.resetPassword('t'.repeat(64), 'Password1'),
    ).rejects.toThrow(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('looks up the hashed token and updates the password', async () => {
    const raw = 'r'.repeat(64);
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      email: 'a@test.dev',
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await service.resetPassword(raw, 'Password1');
    expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { token: hashResetToken(raw) },
    });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
    expect(tx.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { email: 'a@test.dev' },
    });
  });
});
