import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from './tenant-context';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Extracts the club identifier from every request and stores it in
 * AsyncLocalStorage so that downstream services can resolve the correct
 * PostgreSQL schema without needing explicit parameters.
 *
 * Resolution order:
 *   1. X-Club-Id header (set by frontend HTTP interceptor)
 *   2. ?clubId query parameter
 *   3. body.clubId (for POST/PATCH)
 *   4. URL path segment  /club/<uuid>  (catches route params like /courts/club/:clubId/...)
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
    private static readonly logger = new Logger('TenantMiddleware');
    /** Matches a UUID after /club/ in the URL path */
    private static readonly CLUB_PATH_RE =
        /\/club\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

    use(req: Request, res: Response, next: NextFunction) {
        const clubId =
            (req.headers['x-club-id'] as string) ||
            (req.query?.clubId as string) ||
            req.body?.clubId ||
            TenantMiddleware.extractClubIdFromPath(req.path);

        if (isDev) {
            TenantMiddleware.logger.log(
                `[MW] ${req.method} ${req.path} → clubId=${clubId || 'NONE'} ` +
                `(header=${req.headers['x-club-id'] || '-'})`,
            );
        }

        if (clubId) {
            tenantContext.run({ clubId }, next);
        } else {
            next();
        }
    }

    private static extractClubIdFromPath(path: string): string | undefined {
        const match = path.match(TenantMiddleware.CLUB_PATH_RE);
        return match ? match[1] : undefined;
    }
}
