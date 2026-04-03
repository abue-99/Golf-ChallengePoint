import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { Role } from '@golf/db';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env.ACCESS_SECRET = 'test-access-secret';
    strategy = new JwtStrategy();
  });

  describe('validate', () => {
    it('should return an AuthenticatedUser from a valid payload', () => {
      const payload: JwtPayload = {
        sub: 'user-id-123',
        email: 'test@example.com',
        role: 'PLAYER' as Role,
        iat: 1000,
        exp: 9999999999,
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-id-123',
        email: 'test@example.com',
        role: 'PLAYER',
      });
    });

    it('should map sub to id', () => {
      const payload: JwtPayload = {
        sub: 'abc-def',
        email: 'player@golf.com',
        role: 'PLAYER' as Role,
      };

      const result = strategy.validate(payload);

      expect(result.id).toBe('abc-def');
    });

    it('should preserve the role from the payload', () => {
      const payload: JwtPayload = {
        sub: 'coach-id',
        email: 'coach@golf.com',
        role: 'COACH' as Role,
      };

      const result = strategy.validate(payload);

      expect(result.role).toBe('COACH');
    });
  });
});
