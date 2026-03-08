import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager, QueryRunner } from 'typeorm';

/**
 * Per-request tenant context.
 * Populated by TenantMiddleware (clubId) and TenantInterceptor (entityManager/queryRunner).
 */
export interface TenantContext {
    clubId: string;
    /** Tenant-scoped EntityManager (set by TenantInterceptor). */
    entityManager?: EntityManager;
    /** QueryRunner used by the tenant EM (released on response). */
    queryRunner?: QueryRunner;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();
