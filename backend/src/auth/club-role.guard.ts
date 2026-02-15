import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { CLUB_ROLES_KEY } from './club-roles.decorator';
import { UsersService } from '../users/users.service';

/**
 * Guard that checks if the authenticated user has the required role
 * for the club associated with the resource in the request.
 *
 * Club ID resolution order:
 *   1. Route param "clubId"
 *   2. Request body "clubId"
 *   3. Query param "clubId"
 *   4. Route param "id" — lookup entity in DB to find clubId
 *      (supports: leagues, tournaments, courts, league_matches)
 *
 * Super admins (user.role === 'super_admin') bypass all checks.
 */
@Injectable()
export class ClubRoleGuard implements CanActivate {
    private readonly logger = new Logger(ClubRoleGuard.name);

    constructor(
        private reflector: Reflector,
        private usersService: UsersService,
        private dataSource: DataSource,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(
            CLUB_ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // No @ClubRoles decorator = no restriction
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('No autenticado');
        }

        // Super admin bypasses everything
        if (user.role === 'super_admin') {
            return true;
        }

        // Resolve clubId from request
        let clubId =
            request.params?.clubId ||
            request.body?.clubId ||
            request.query?.clubId;

        // If no clubId found directly, try to resolve from resource ID
        if (!clubId && request.params?.id) {
            clubId = await this.resolveClubIdFromResource(request.params.id);
        }

        if (!clubId) {
            this.logger.warn('ClubRoleGuard: No se pudo determinar el clubId del request');
            throw new ForbiddenException('No se pudo determinar el club para verificar permisos');
        }

        // Check if user has at least one of the required roles for this club
        for (const role of requiredRoles) {
            const hasRole = await this.usersService.hasClubRole(user.userId, clubId, role);
            if (hasRole) {
                return true;
            }
        }

        throw new ForbiddenException(
            `No tienes permisos suficientes para este club. Se requiere: ${requiredRoles.join(' o ')}`
        );
    }

    /**
     * Try to find clubId by looking up the resource ID in known tables.
     * Checks: clubs, leagues, tournaments, courts, players,
     *         league_matches (via league), matches (via tournament),
     *         court_price_blocks (via court), reservations (via court)
     */
    private async resolveClubIdFromResource(resourceId: string): Promise<string | null> {
        // Direct clubId column lookups
        const directTables = [
            'clubs',
            'leagues',
            'tournaments',
            'courts',
            'players',
        ];

        for (const table of directTables) {
            try {
                const col = table === 'clubs' ? 'id' : '"clubId"';
                const rows = await this.dataSource.query(
                    `SELECT ${col} as "clubId" FROM "${table}" WHERE "id" = $1 LIMIT 1`,
                    [resourceId]
                );
                if (rows.length > 0 && rows[0].clubId) {
                    return rows[0].clubId;
                }
            } catch {
                // Table might not exist or ID format mismatch — skip
            }
        }

        // Join-based lookups
        const joinQueries = [
            // league_matches → leagues
            `SELECT l."clubId" FROM "league_matches" lm JOIN "leagues" l ON lm."leagueId" = l."id" WHERE lm."id" = $1 LIMIT 1`,
            // matches (tournament) → tournaments
            `SELECT t."clubId" FROM "matches" m JOIN "tournaments" t ON m."tournamentId" = t."id" WHERE m."id" = $1 LIMIT 1`,
            // court_price_blocks → courts
            `SELECT c."clubId" FROM "court_price_blocks" pb JOIN "courts" c ON pb."courtId" = c."id" WHERE pb."id" = $1 LIMIT 1`,
            // reservations → courts
            `SELECT c."clubId" FROM "reservations" r JOIN "courts" c ON r."courtId" = c."id" WHERE r."id" = $1 LIMIT 1`,
        ];

        for (const query of joinQueries) {
            try {
                const rows = await this.dataSource.query(query, [resourceId]);
                if (rows.length > 0 && rows[0].clubId) {
                    return rows[0].clubId;
                }
            } catch {
                // skip
            }
        }

        return null;
    }
}
