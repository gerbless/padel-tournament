import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
    NotFoundException,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, finalize } from 'rxjs/operators';
import { DataSource, QueryRunner } from 'typeorm';
import { TenantService } from './tenant.service';
import { tenantContext } from './tenant-context';
import { Request } from 'express';

const isDev = process.env.NODE_ENV !== 'production';

/** Matches a UUID after /club/ in the URL path */
const CLUB_PATH_RE =
    /\/club\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * Global interceptor that sets the PostgreSQL search_path to the
 * current club's schema for every request that carries a club context.
 *
 * Extracts clubId from (in order):
 *   1. AsyncLocalStorage (set by TenantMiddleware, when context propagates)
 *   2. X-Club-Id header
 *   3. ?clubId query parameter
 *   4. body.clubId
 *   5. URL path segment  /club/<uuid>
 *
 * Then acquires a QueryRunner, sets the search_path, and stores the
 * tenant-scoped EntityManager in AsyncLocalStorage so that
 * TenantService.getRepo() / .query() transparently route to the
 * correct schema.
 *
 * On response (or error), the search_path is reset and the QR released.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
    private readonly logger = new Logger(TenantInterceptor.name);

    constructor(
        private readonly tenant: TenantService,
        private readonly dataSource: DataSource,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest<Request>();

        // Try AsyncLocalStorage first (set by TenantMiddleware)
        let clubId = tenantContext.getStore()?.clubId;
        let source = 'als';

        // Fallback: extract from the HTTP request directly
        if (!clubId) {
            clubId = this.extractClubId(req);
            source = 'request';
        }

        if (isDev) {
            this.logger.log(
                `[${req?.method} ${req?.url}] clubId=${clubId || 'NONE'} (source=${source}) ` +
                `header=${req?.headers?.['x-club-id'] || '-'} als=${!!tenantContext.getStore()}`,
            );
        }

        // No tenant context → pass through (public schema only)
        if (!clubId) {
            return next.handle();
        }

        const resolvedClubId = clubId;

        return from(this.setupSchema(resolvedClubId)).pipe(
            switchMap((qr) => {
                // Wrap the downstream handler in a new AsyncLocalStorage context
                // so that TenantService.getRepo() / .query() work even when
                // the middleware context was lost.
                return new Observable((subscriber) => {
                    const store = tenantContext.getStore() || { clubId: resolvedClubId };
                    if (qr) {
                        store.clubId = resolvedClubId;
                        store.entityManager = qr.manager;
                        store.queryRunner = qr;
                    }
                    tenantContext.run(store, () => {
                        next.handle().subscribe({
                            next: (val) => subscriber.next(val),
                            error: (err) => subscriber.error(err),
                            complete: () => subscriber.complete(),
                        });
                    });
                }).pipe(
                    finalize(async () => {
                        if (qr) {
                            try {
                                await qr.query('SET search_path TO public');
                            } catch {
                                /* connection may already be closed */
                            }
                            await qr.release().catch(() => {});
                        }
                    }),
                );
            }),
        );
    }

    /**
     * Extract clubId from an HTTP request using multiple strategies.
     */
    private extractClubId(req: Request): string | undefined {
        if (!req) return undefined;

        // 1. Header
        const fromHeader = req.headers?.['x-club-id'] as string;
        if (fromHeader) return fromHeader;

        // 2. Query param
        const fromQuery = req.query?.clubId as string;
        if (fromQuery) return fromQuery;

        // 3. Body
        const fromBody = req.body?.clubId;
        if (fromBody) return fromBody;

        // 4. URL path: /club/<uuid>
        const match = req.path?.match(CLUB_PATH_RE);
        return match ? match[1] : undefined;
    }

    /**
     * Resolve the club's schema, acquire a QR, set search_path.
     * Returns the QueryRunner (or null if the club has no schema yet).
     * Throws NotFoundException if the club doesn't exist in the DB.
     */
    private async setupSchema(clubId: string): Promise<QueryRunner | null> {
        let schemaName: string;
        try {
            schemaName = await this.tenant.getSchemaName(clubId);
        } catch (err) {
            // Propagate NotFoundException so frontend gets a clear 404
            if (err instanceof NotFoundException) throw err;
            if (isDev) this.logger.warn(`setupSchema FAILED for ${clubId}: ${err.message}`);
            // Club may not have a schema yet (legacy club)
            return null;
        }

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.query(`SET search_path TO "${schemaName}", public`);

        this.logger.debug(`---------------------------------------------------`)
        if (isDev) this.logger.log(`setupSchema OK: club=${clubId} → schema=${schemaName}`);
        this.logger.debug(`---------------------------------------------------`)
        
        return qr;
    }
}
