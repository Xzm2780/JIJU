import {
  CanActivate,
  ExecutionContext,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ROLES_KEY } from './admin-roles.decorator';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (requiredRoles.length === 0) {
      throw new ApiError('JIJU_ACCESS_4031', 403, '你无权执行此操作');
    }

    const assignment = await this.prisma.adminRoleAssignment.findFirst({
      where: {
        userId: request.user.id,
        active: true,
        revokedAt: null,
        role: { in: requiredRoles }
      }
    });
    if (!assignment) {
      throw new ApiError('JIJU_ACCESS_4031', 403, '你无权执行此操作');
    }

    return true;
  }
}
