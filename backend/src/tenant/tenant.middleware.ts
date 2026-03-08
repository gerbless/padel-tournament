import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from './tenant-context';

/**
 * Extracts the club identifier from every request and stores it in
 * AsyncLocalStorage so that downstream services can resolve the correct
 * PostgreSQL schema without needing explicit parameters.
 *
 * Resolution order:
 *   1. X-Club-Id header (set by frontend HTTP interceptor)
 *   2. ?clubId query parameter
 *   3. body.clubId (for POST/PATCH)
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const clubId =
            (req.headers['x-club-id'] as string) ||
            (req.query?.clubId as string) ||
            req.body?.clubId;

        if (clubId) {
            tenantContext.run({ clubId }, next);
        } else {
            next();
        }
    }
}
