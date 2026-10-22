import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  const mockContext = {} as ExecutionContext;

  describe('handleRequest', () => {
    it('should return the user when no error and user is present', () => {
      const user = { id: '1', email: 'test@example.com', role: 'PLAYER' };
      const result = guard.handleRequest(null, user);
      expect(result).toBe(user);
    });

    it('should throw UnauthorizedException when user is null', () => {
      expect(() => guard.handleRequest(null, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is undefined', () => {
      expect(() => guard.handleRequest(null, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when an error is provided', () => {
      const error = new Error('JWT error');
      expect(() => guard.handleRequest(error, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException with correct message', () => {
      try {
        guard.handleRequest(null, null);
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        const response = (e as UnauthorizedException).getResponse() as Record<
          string,
          unknown
        >;
        expect(response.message).toBe('Invalid or expired token');
        expect(response.statusCode).toBe(401);
      }
    });

    it('should throw UnauthorizedException when error is present even with a user', () => {
      const user = { id: '1', email: 'test@example.com', role: 'PLAYER' };
      const error = new Error('JWT error');
      expect(() => guard.handleRequest(error, user)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
