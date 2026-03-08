import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    DataSource,
    EntityManager,
    EntityTarget,
    ObjectLiteral,
    QueryRunner,
    Repository,
} from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Club } from '../clubs/entities/club.entity';
import { tenantContext } from './tenant-context';

@Injectable()
export class TenantService {
    private readonly logger = new Logger(TenantService.name);
    /** In-process cache: clubId → schemaName */
    private schemaCache = new Map<string, string>();

    constructor(
        readonly dataSource: DataSource,
        private config: ConfigService,
        @InjectRepository(Club)
        private clubRepo: Repository<Club>,
    ) {}

    // ─── Context helpers ────────────────────────────────────────────────

    /** Get the current clubId from request context (set by TenantMiddleware). */
    getCurrentClubId(): string | undefined {
        return tenantContext.getStore()?.clubId;
    }

    /** Generate a deterministic schema name from a club UUID. */
    generateSchemaName(clubId: string): string {
        return `club_${clubId.replace(/-/g, '_')}`;
    }

    // ─── Schema name resolution ─────────────────────────────────────────

    /** Resolve the schema name for a club. Result is cached in-process. */
    async getSchemaName(clubId: string): Promise<string> {
        const cached = this.schemaCache.get(clubId);
        if (cached) return cached;

        const club = await this.clubRepo.findOne({
            where: { id: clubId },
            select: ['id', 'schemaName'],
        });

        if (!club?.schemaName) {
            throw new Error(`Club ${clubId} has no schema assigned`);
        }

        this.schemaCache.set(clubId, club.schemaName);
        return club.schemaName;
    }

    // ─── Tenant-aware repository & query helpers ────────────────────────

    /**
     * Get a tenant-scoped Repository.
     *
     * If the TenantInterceptor has already set up a schema-scoped
     * EntityManager for the current request, uses that EM so queries
     * automatically target the club schema.  Otherwise falls back to
     * the default DataSource (public schema).
     */
    getRepo<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
        const store = tenantContext.getStore();
        if (store?.entityManager) {
            return store.entityManager.getRepository(entity);
        }
        return this.dataSource.getRepository(entity);
    }

    /**
     * Run a raw SQL query within the current tenant context.
     *
     * Uses the interceptor's QueryRunner when available so that
     * search_path is already set to the club schema.
     */
    async query(sql: string, params?: any[]): Promise<any> {
        const store = tenantContext.getStore();
        if (store?.entityManager) {
            return store.entityManager.query(sql, params);
        }
        return this.dataSource.query(sql, params);
    }

    // ─── Schema-scoped execution (explicit) ─────────────────────────────

    /**
     * Create a QueryRunner with search_path set to the current tenant's schema.
     * Used for transaction blocks that need their own QR/transaction.
     *
     * IMPORTANT: The caller is responsible for releasing the returned QR
     * (ideally in a try/finally block).
     */
    async createQueryRunner(clubId?: string): Promise<QueryRunner> {
        const cid = clubId || this.getCurrentClubId();
        if (!cid) {
            // No tenant context – return a plain QR (public schema)
            const qr = this.dataSource.createQueryRunner();
            await qr.connect();
            return qr;
        }
        const schemaName = await this.getSchemaName(cid);
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.query(`SET search_path TO "${schemaName}", public`);
        return qr;
    }

    /**
     * Execute `fn` within a club's schema context.
     *
     * If the TenantInterceptor has already set the search_path for the
     * same club, the existing EntityManager is reused (no extra connection).
     * Otherwise acquires a dedicated QueryRunner, sets search_path,
     * executes fn, and cleans up.
     */
    async run<T>(
        clubId: string,
        fn: (em: EntityManager, qr: QueryRunner) => Promise<T>,
    ): Promise<T> {
        // Reuse interceptor-created context if it matches the requested club
        const store = tenantContext.getStore();
        if (store?.entityManager && store?.queryRunner && store.clubId === clubId) {
            return fn(store.entityManager, store.queryRunner);
        }

        const schemaName = await this.getSchemaName(clubId);
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        try {
            await qr.query(`SET search_path TO "${schemaName}", public`);
            return await fn(qr.manager, qr);
        } finally {
            await qr.query(`SET search_path TO public`);
            await qr.release();
        }
    }

    /**
     * Convenience wrapper: execute in the current request's club schema
     * (resolved from AsyncLocalStorage / X-Club-Id header).
     */
    async runInContext<T>(
        fn: (em: EntityManager, qr: QueryRunner) => Promise<T>,
    ): Promise<T> {
        const clubId = this.getCurrentClubId();
        if (!clubId) {
            throw new Error(
                'No tenant context available – ensure the request includes X-Club-Id header or ?clubId query param.',
            );
        }
        return this.run(clubId, fn);
    }

    // ─── Schema lifecycle ───────────────────────────────────────────────

    /**
     * Create a new PostgreSQL schema for a club and initialise all
     * club-specific tables by cloning structure from public schema
     * (using CREATE TABLE ... LIKE).
     */
    async createSchemaForClub(schemaName: string): Promise<void> {
        const tables = [
            'tournaments', 'teams', 'matches',
            'leagues', 'league_teams', 'league_matches',
            'courts', 'court_price_blocks', 'court_blocks',
            'reservations', 'free_play_matches',
            'mercadopago_payments', 'player_club_stats',
        ];

        this.logger.log(
            `Creating schema "${schemaName}" with ${tables.length} tables…`,
        );

        // 1. Create the PostgreSQL schema
        await this.dataSource.query(
            `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
        );

        // 2. Clone each table from public schema
        for (const table of tables) {
            const exists = await this.dataSource.query(
                `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
                [table],
            );
            if (!exists[0]?.exists) {
                this.logger.warn(`Table public."${table}" does not exist, skipping`);
                continue;
            }

            const alreadyCreated = await this.dataSource.query(
                `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)`,
                [schemaName, table],
            );
            if (alreadyCreated[0]?.exists) continue;

            await this.dataSource.query(`
                CREATE TABLE "${schemaName}"."${table}"
                (LIKE public."${table}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)
            `);
        }

        this.logger.log(`Schema "${schemaName}" initialised successfully.`);
    }

    /**
     * Drop a club's schema (destructive — use with extreme care).
     */
    async dropSchema(schemaName: string): Promise<void> {
        await this.dataSource.query(
            `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
        );
        this.logger.warn(`Schema "${schemaName}" dropped.`);
    }

    /** Invalidate the in-process schema cache. */
    clearCache(clubId?: string): void {
        if (clubId) {
            this.schemaCache.delete(clubId);
        } else {
            this.schemaCache.clear();
        }
    }
}
