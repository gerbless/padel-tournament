import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guard that only allows users with role === 'super_admin'.
 * Must be combined with JwtAuthGuard.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (user?.role === 'super_admin') return true;
        throw new ForbiddenException('Solo el super administrador puede realizar esta acción.');
    }
}
