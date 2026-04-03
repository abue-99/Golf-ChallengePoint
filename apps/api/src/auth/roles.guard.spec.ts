import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@challengepoint/db';
import { RolesGuard } from './roles.guard';
import { InsufficientRoleException } from '../common/exceptions/auth.exception';
import { ROLES_KEY } from './roles.decorator';

const makeContext = (user: unknown, handler = {}, cls = {}): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext({ id: '1', role: 'PLAYER' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when required roles array is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const ctx = makeContext({ id: '1', role: 'PLAYER' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when the user has a required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['PLAYER'] as Role[]);
    const ctx = makeContext({ id: '1', role: 'PLAYER' as Role });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when the user has one of multiple required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['COACH', 'PLAYER'] as Role[]);
    const ctx = makeContext({ id: '1', role: 'COACH' as Role });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw InsufficientRoleException when the user role does not match', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['COACH'] as Role[]);
    const ctx = makeContext({ id: '1', role: 'PLAYER' as Role });
    expect(() => guard.canActivate(ctx)).toThrow(InsufficientRoleException);
  });

  it('should throw InsufficientRoleException when there is no user', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['COACH'] as Role[]);
    const ctx = makeContext(null);
    expect(() => guard.canActivate(ctx)).toThrow(InsufficientRoleException);
  });

  it('should call reflector with ROLES_KEY and both handler and class', () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(undefined);
    const handler = {};
    const cls = {};
    const ctx = makeContext({ id: '1', role: 'PLAYER' }, handler, cls);

    guard.canActivate(ctx);

    expect(spy).toHaveBeenCalledWith(ROLES_KEY, [handler, cls]);
  });
});
