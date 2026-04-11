import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@challengepoint/db';
import { ROLES_KEY } from './roles.decorator';
import { InsufficientRoleException } from '../common/exceptions/auth.exception';
import { AuthenticatedUser } from './jwt.strategy';

/** Ordered from lowest to highest privilege. */
const ROLE_HIERARCHY: Role[] = [Role.PLAYER, Role.COACH, Role.ADMIN, Role.SYSADMIN];

function meetsRoleRequirement(userRole: Role, requiredRoles: Role[]): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  return requiredRoles.some((r) => {
    const requiredLevel = ROLE_HIERARCHY.indexOf(r);
    return userLevel >= requiredLevel;
  });
}

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

    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user: AuthenticatedUser = request.user;

    if (!user || !meetsRoleRequirement(user.role, requiredRoles)) {
      throw new InsufficientRoleException();
    }

    return true;
  }
}
