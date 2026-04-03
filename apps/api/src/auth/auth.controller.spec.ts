jest.mock('@golf/db', () => ({
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
import { Response, Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvalidTokenException } from '../common/exceptions/auth.exception';

const mockAuthService = {
  signup: jest.fn(),
  login: jest.fn(),
  validateRefreshToken: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  getMe: jest.fn(),
};

const mockResponse = () => {
  const res: Partial<Response> = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
  return res as Response;
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('signup', () => {
    const dto = { email: 'new@example.com', password: 'password123' };
    const user = { id: 'uid', email: 'new@example.com', role: 'PLAYER' };

    it('should return accessToken and user', async () => {
      mockAuthService.signup.mockResolvedValue({ accessToken: 'acc-token', user });
      mockAuthService.generateRefreshToken.mockReturnValue('ref-token');
      const res = mockResponse();

      const result = await controller.signup(dto as any, res);

      expect(result).toEqual({ accessToken: 'acc-token', user });
    });

    it('should set a refresh_token cookie', async () => {
      mockAuthService.signup.mockResolvedValue({ accessToken: 'acc-token', user });
      mockAuthService.generateRefreshToken.mockReturnValue('ref-token');
      const res = mockResponse();

      await controller.signup(dto as any, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'ref-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should propagate errors from auth service', async () => {
      mockAuthService.signup.mockRejectedValue(new Error('Email already in use'));
      const res = mockResponse();

      await expect(controller.signup(dto as any, res)).rejects.toThrow('Email already in use');
    });
  });

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'password123' };
    const user = { id: 'uid', email: 'test@example.com', role: 'PLAYER' };

    it('should return accessToken and user', async () => {
      mockAuthService.login.mockResolvedValue({ accessToken: 'acc-token', user });
      mockAuthService.generateRefreshToken.mockReturnValue('ref-token');
      const res = mockResponse();

      const result = await controller.login(dto as any, res);

      expect(result).toEqual({ accessToken: 'acc-token', user });
    });

    it('should set a refresh_token cookie', async () => {
      mockAuthService.login.mockResolvedValue({ accessToken: 'acc-token', user });
      mockAuthService.generateRefreshToken.mockReturnValue('ref-token');
      const res = mockResponse();

      await controller.login(dto as any, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'ref-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
    });

    it('should propagate errors from auth service', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));
      const res = mockResponse();

      await expect(controller.login(dto as any, res)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refresh', () => {
    it('should return a new accessToken when refresh token is valid', async () => {
      const user = { id: 'uid', email: 'test@example.com', role: 'PLAYER' };
      mockAuthService.validateRefreshToken.mockResolvedValue(user);
      mockAuthService.generateAccessToken.mockReturnValue('new-access-token');
      mockAuthService.generateRefreshToken.mockReturnValue('new-refresh-token');

      const req = { cookies: { refresh_token: 'valid-refresh' } } as unknown as Request;
      const res = mockResponse();

      const result = await controller.refresh(req, res);

      expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('should rotate the refresh token cookie', async () => {
      const user = { id: 'uid', email: 'test@example.com', role: 'PLAYER' };
      mockAuthService.validateRefreshToken.mockResolvedValue(user);
      mockAuthService.generateAccessToken.mockReturnValue('new-access-token');
      mockAuthService.generateRefreshToken.mockReturnValue('new-refresh-token');

      const req = { cookies: { refresh_token: 'valid-refresh' } } as unknown as Request;
      const res = mockResponse();

      await controller.refresh(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should throw InvalidTokenException when no refresh token cookie', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = mockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow(InvalidTokenException);
    });
  });

  describe('logout', () => {
    it('should clear the refresh_token cookie and return success message', () => {
      const res = mockResponse();

      const result = controller.logout(res);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('me', () => {
    it('should return user data from authService.getMe', async () => {
      const user = { id: 'uid', email: 'test@example.com', role: 'PLAYER' };
      const profile = { ...user, createdAt: new Date(), lastLogin: null };
      mockAuthService.getMe.mockResolvedValue(profile);

      const result = await controller.me(user as any);

      expect(result).toEqual(profile);
      expect(mockAuthService.getMe).toHaveBeenCalledWith('uid');
    });
  });
});
