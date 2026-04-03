jest.mock('@challengepoint/db', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
    user: {},
    playerProfile: {},
    coachPlayerLink: {},
    taskTemplate: {},
    passwordResetToken: {},
  },
  Role: {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvalidCredentialsException } from '../common/exceptions/auth.exception';

const mockUser = {
  id: 'user-id-1',
  email: 'test@example.com',
  passwordHash: '$2b$10$hashedpassword',
  role: 'PLAYER',
  firstName: 'Test',
  lastName: 'User',
  createdAt: new Date('2024-01-01'),
  lastLogin: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  describe('signup', () => {
    const signupDto = {
      email: 'new@example.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
    };

    it('should create a user and return tokens when email is not taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, email: signupDto.email.toLowerCase() });
      mockJwtService.sign.mockReturnValue('access-token');

      const result = await service.signup(signupDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.user.email).toBe(signupDto.email.toLowerCase());
    });

    it('should throw BadRequestException when email is already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.signup(signupDto)).rejects.toThrow(BadRequestException);
      await expect(service.signup(signupDto)).rejects.toThrow('Email already in use');
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, email: 'new@example.com' });
      mockJwtService.sign.mockReturnValue('access-token');

      await service.signup({ ...signupDto, email: 'NEW@EXAMPLE.COM' });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'new@example.com' }) }),
      );
    });

    it('should hash the password before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('access-token');

      await service.signup(signupDto);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      const storedHash = createCall.data.passwordHash;
      const matches = await bcrypt.compare(signupDto.password, storedHash);
      expect(matches).toBe(true);
    });

    it('should default firstName to "User" when not provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('access-token');

      await service.signup({ email: 'a@b.com', password: 'pass123' });

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.firstName).toBe('User');
    });

    it('should default role to PLAYER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('access-token');

      await service.signup(signupDto);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('PLAYER');
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'correctpassword' };

    it('should return accessToken and user when credentials are valid', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      const userWithHash = { ...mockUser, passwordHash: hash };
      mockPrisma.user.findUnique.mockResolvedValue(userWithHash);
      mockPrisma.user.update.mockResolvedValue(userWithHash);
      mockJwtService.sign.mockReturnValue('access-token');

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should throw InvalidCredentialsException when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(InvalidCredentialsException);
    });

    it('should throw InvalidCredentialsException when password does not match', async () => {
      const hash = await bcrypt.hash('differentpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(service.login(loginDto)).rejects.toThrow(InvalidCredentialsException);
    });

    it('should normalize email to lowercase', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('access-token');

      await service.login({ ...loginDto, email: 'TEST@EXAMPLE.COM' });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should update lastLogin on successful login', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('access-token');

      await service.login(loginDto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ lastLogin: expect.any(Date) }),
        }),
      );
    });
  });

  describe('generateAccessToken', () => {
    it('should call jwtService.sign with correct payload', () => {
      mockJwtService.sign.mockReturnValue('signed-token');

      const token = service.generateAccessToken('uid', 'u@test.com', 'PLAYER');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'uid', email: 'u@test.com', role: 'PLAYER' },
        expect.objectContaining({ secret: process.env.ACCESS_SECRET }),
      );
      expect(token).toBe('signed-token');
    });
  });

  describe('generateRefreshToken', () => {
    it('should call jwtService.sign with sub payload', () => {
      mockJwtService.sign.mockReturnValue('refresh-token');

      const token = service.generateRefreshToken('uid');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'uid' },
        expect.objectContaining({ secret: process.env.REFRESH_SECRET }),
      );
      expect(token).toBe('refresh-token');
    });
  });

  describe('validateRefreshToken', () => {
    it('should return authenticated user when token is valid', async () => {
      mockJwtService.verify.mockReturnValue({ sub: mockUser.id });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateRefreshToken('valid-refresh-token');

      expect(result).toEqual({ id: mockUser.id, email: mockUser.email, role: mockUser.role });
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.validateRefreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is not found after valid token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'non-existent-id' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.validateRefreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMe', () => {
    it('should return user data when user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          lastLogin: true,
        },
      });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('non-existent-id')).rejects.toThrow(UnauthorizedException);
    });
  });
});
