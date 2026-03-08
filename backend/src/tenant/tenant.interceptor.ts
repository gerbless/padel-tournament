import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, finalize } from 'rxjs/operators';
import { DataSource, QueryRunner } from 'typeorm';
import { TenantService } from './tenant.service';
import { tenantContext } from './tenant-context';

/**
 * Global interceptor that sets the PostgreSQL search_path to the
 * current club's schema for every request that carries a club context.
 *
 * The TenantMiddleware (which runs before interceptors) stores the
 * clubId in AsyncLocalStorage.  This interceptor resolves the schema
 * name, acquires a QueryRunner, sets the search_path, and stores the
 * tenant-scoped EntityManager back in the AsyncLocalStorage so that
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
        const store = tenantContext.getStore();
        const clubId = store?.clubId;

        // No tenant context → pass through (public schema only)
        if (!clubId) {
            return next.handle();
        }

        return from(this.setupSchema(clubId)).pipe(
            switchMap((qr) => {
                return next.handle().pipe(
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
     * Resolve the club's schema, acquire a QR, set search_path,
     * and store the tenant EM in AsyncLocalStorage.
     * Returns the QueryRunner (or null if the club has no schema yet).
     */
    private async setupSchema(clubId: string): Promise<QueryRunner | null> {
        let schemaName: string;
        try {
            schemaName = await this.tenant.getSchemaName(clubId);
        } catch {
            // Club may not have a schema yet (legacy club)
            return null;
        }

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.query(`SET search_path TO "${schemaName}", public`);

        // Store tenant EM in the same AsyncLocalStorage context
        const store = tenantContext.getStore();
        if (store) {
            store.entityManager = qr.manager;
            store.queryRunner = qr;
        }

        return qr;
    }
}
