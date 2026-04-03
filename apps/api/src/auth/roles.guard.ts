import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@challengepoint/db';
import { ROLES_KEY } from './roles.decorator';
import { InsufficientRoleException } from '../common/exceptions/auth.exception';
import { AuthenticatedUser } from './jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new InsufficientRoleException();
    }

    return true;
  }
}
