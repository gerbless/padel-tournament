import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Entity names whose tables only exist inside per-club schemas.
 * If getRepo() is called for one of these without a tenant context
 * the query would fail with "relation does not exist" — so we throw
 * a clear 400 instead.
 */
const CLUB_SCOPED_ENTITIES = new Set([
    'Tournament', 'Team', 'Match', 'League', 'LeagueTeam', 'LeagueMatch',
    'Court', 'CourtPriceBlock', 'CourtBlock', 'Reservation',
    'FreePlayMatch', 'MercadoPagoPayment', 'PlayerClubStats',
]);

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

        if (!club) {
            throw new NotFoundException(`El club ${clubId} no existe.`);
        }

        if (!club.schemaName) {
            // Club exists but has no schema — auto-create it
            if (isDev) {
                this.logger.warn(`Club ${clubId} has no schema – auto-creating…`);
            }
            const schemaName = this.generateSchemaName(clubId);
            await this.createSchemaForClub(schemaName);
            await this.clubRepo.update(clubId, { schemaName });
            this.schemaCache.set(clubId, schemaName);
            return schemaName;
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

        // Guard: club-scoped entities MUST have tenant context
        const name = typeof entity === 'function' ? entity.name : String(entity);
        if (CLUB_SCOPED_ENTITIES.has(name)) {
            if (isDev) {
                this.logger.error(
                    `getRepo(${name}): club-scoped entity requested WITHOUT tenant context. ` +
                    `Ensure the request sends X-Club-Id header or clubId param.`,
                );
            }
            throw new BadRequestException(
                `Se requiere contexto de club para acceder a ${name}. ` +
                `Envía el header X-Club-Id o el parámetro clubId.`,
            );
        }

        if (isDev) {
            this.logger.warn(`getRepo(${name}): no tenant EM – using public schema`);
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
        if (isDev) {
            this.logger.warn(`query(): no tenant EM – using public schema. SQL snippet: ${sql.substring(0, 100)}...`);
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
     * ALWAYS acquires a dedicated QueryRunner with its own search_path
     * to guarantee isolation from the interceptor's shared QR.
     */
    async run<T>(
        clubId: string,
        fn: (em: EntityManager, qr: QueryRunner) => Promise<T>,
    ): Promise<T> {
        const schemaName = await this.getSchemaName(clubId);
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        try {
            await qr.query(`SET search_path TO "${schemaName}", public`);
            return await fn(qr.manager, qr);
        } finally {
            try { await qr.query(`SET search_path TO public`); } catch {}
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
     * club-specific tables with full DDL (columns, defaults, enums,
     * primary keys, unique constraints, indexes, and foreign keys).
     *
     * We use explicit DDL instead of CREATE TABLE ... LIKE because the
     * source tables no longer exist in the public schema — they live
     * exclusively in per-club schemas.
     */
    async createSchemaForClub(schemaName: string): Promise<void> {
        const s = `"${schemaName}"`;

        this.logger.log(`Creating schema ${s} with club tables…`);

        // 1. Create the PostgreSQL schema
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);

        // 2. Create all 13 tables in dependency order
        // ── tournaments (no FK deps) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."tournaments" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                name character varying NOT NULL,
                type public.tournaments_type_enum NOT NULL,
                status public.tournaments_status_enum DEFAULT 'draft'::public.tournaments_status_enum NOT NULL,
                "clubId" uuid,
                "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
                config jsonb,
                courts integer DEFAULT 1 NOT NULL,
                "durationMode" public.tournaments_durationmode_enum DEFAULT 'free'::public.tournaments_durationmode_enum NOT NULL,
                "durationMinutes" integer,
                "matchesPerTeam" integer,
                "totalGroups" integer
            )
        `);

        // ── teams (FK → tournaments) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."teams" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "player1Id" uuid NOT NULL,
                "player2Id" uuid NOT NULL,
                "tournamentId" uuid NOT NULL,
                "groupNumber" integer
            )
        `);

        // ── matches (FK → tournaments, teams) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."matches" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "tournamentId" uuid NOT NULL,
                "team1Id" uuid NOT NULL,
                "team2Id" uuid NOT NULL,
                status public.matches_status_enum DEFAULT 'pending'::public.matches_status_enum NOT NULL,
                sets jsonb,
                "winnerId" uuid,
                "groupNumber" integer,
                "courtNumber" integer,
                round integer,
                phase public.matches_phase_enum
            )
        `);

        // ── leagues (no FK deps) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."leagues" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                name character varying NOT NULL,
                type public.leagues_type_enum NOT NULL,
                config jsonb DEFAULT '{}'::jsonb NOT NULL,
                status public.leagues_status_enum DEFAULT 'draft'::public.leagues_status_enum NOT NULL,
                "startDate" timestamp without time zone,
                "endDate" timestamp without time zone,
                "clubId" uuid,
                "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
            )
        `);

        // ── league_teams (FK → leagues) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."league_teams" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "leagueId" uuid NOT NULL,
                "player1Id" uuid NOT NULL,
                "player2Id" uuid NOT NULL,
                "teamName" character varying,
                "matchesPlayed" integer DEFAULT 0 NOT NULL,
                "matchesWon" integer DEFAULT 0 NOT NULL,
                "matchesLost" integer DEFAULT 0 NOT NULL,
                points integer DEFAULT 0 NOT NULL,
                "setsWon" integer DEFAULT 0 NOT NULL,
                "setsLost" integer DEFAULT 0 NOT NULL,
                "gamesWon" integer DEFAULT 0 NOT NULL,
                "gamesLost" integer DEFAULT 0 NOT NULL,
                "group" character varying
            )
        `);

        // ── league_matches (FK → leagues, league_teams) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."league_matches" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "leagueId" uuid NOT NULL,
                "team1Id" uuid NOT NULL,
                "team2Id" uuid NOT NULL,
                round integer NOT NULL,
                "group" character varying,
                status public.league_matches_status_enum DEFAULT 'pending'::public.league_matches_status_enum NOT NULL,
                sets jsonb,
                "winnerId" uuid,
                "matchDate" timestamp without time zone
            )
        `);

        // ── courts (no FK deps) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."courts" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "clubId" uuid NOT NULL,
                name character varying NOT NULL,
                "courtNumber" integer NOT NULL,
                "surfaceType" character varying,
                "isActive" boolean DEFAULT true,
                "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ── court_price_blocks (FK → courts) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."court_price_blocks" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "courtId" uuid NOT NULL,
                "daysOfWeek" jsonb DEFAULT '[]'::jsonb,
                "startTime" character varying NOT NULL,
                "endTime" character varying NOT NULL,
                "priceFullCourt" numeric(10,2) DEFAULT 0,
                "pricePerPlayer" numeric(10,2) DEFAULT 0,
                "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ── court_blocks (no FK deps) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."court_blocks" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
                "clubId" character varying NOT NULL,
                "startDate" date NOT NULL,
                "endDate" date NOT NULL,
                "blockType" public.block_type_enum DEFAULT 'full_day'::public.block_type_enum NOT NULL,
                "customStartTime" character varying,
                "customEndTime" character varying,
                "courtIds" jsonb,
                reason character varying DEFAULT ''::character varying NOT NULL,
                "isActive" boolean DEFAULT true NOT NULL,
                "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
                PRIMARY KEY (id)
            )
        `);

        // ── reservations (FK → courts) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."reservations" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "courtId" uuid NOT NULL,
                "clubId" uuid NOT NULL,
                date date NOT NULL,
                "startTime" character varying NOT NULL,
                "endTime" character varying NOT NULL,
                title character varying,
                status public.reservation_status_enum DEFAULT 'confirmed'::public.reservation_status_enum,
                players jsonb DEFAULT '[]'::jsonb,
                "playerCount" integer DEFAULT 4,
                "priceType" public.price_type_enum DEFAULT 'full_court'::public.price_type_enum,
                "basePrice" numeric(10,2) DEFAULT 0,
                "finalPrice" numeric(10,2) DEFAULT 0,
                "paymentStatus" public.payment_status_enum DEFAULT 'pending'::public.payment_status_enum,
                "paymentNotes" text,
                "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                "playerPayments" jsonb,
                "paymentExpiresAt" timestamp with time zone,
                "paymentMethod" public.reservations_paymentmethod_enum,
                "countsForRanking" boolean DEFAULT false
            )
        `);

        // ── free_play_matches (FK → reservations) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."free_play_matches" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "reservationId" uuid,
                "clubId" uuid,
                date date NOT NULL,
                "team1PlayerIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
                "team2PlayerIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
                "team1Names" jsonb DEFAULT '[]'::jsonb NOT NULL,
                "team2Names" jsonb DEFAULT '[]'::jsonb NOT NULL,
                sets jsonb DEFAULT '[]'::jsonb NOT NULL,
                winner integer,
                "countsForRanking" boolean DEFAULT true NOT NULL,
                "pointsPerWin" integer DEFAULT 3 NOT NULL,
                status character varying DEFAULT 'pending'::character varying NOT NULL,
                "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
                CONSTRAINT "free_play_matches_reservationId_key" UNIQUE ("reservationId")
            )
        `);

        // ── mercadopago_payments (FK → reservations) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."mercadopago_payments" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "reservationId" uuid,
                "clubId" uuid NOT NULL,
                "preferenceId" character varying,
                "mpPaymentId" character varying,
                "externalReference" character varying NOT NULL,
                amount numeric(10,2) DEFAULT 0 NOT NULL,
                currency character varying DEFAULT 'CLP'::character varying NOT NULL,
                description character varying,
                "payerEmail" character varying,
                status public.mercadopago_payment_status_enum DEFAULT 'pending'::public.mercadopago_payment_status_enum NOT NULL,
                "statusDetail" character varying,
                "paymentMethod" character varying,
                "mpData" jsonb,
                "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
                "playerIndex" integer,
                "playerName" character varying,
                "playerId" character varying,
                CONSTRAINT "mercadopago_payments_externalReference_key" UNIQUE ("externalReference")
            )
        `);

        // ── player_club_stats (no FK deps to other club tables) ──
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS ${s}."player_club_stats" (
                id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "totalPoints" integer DEFAULT 0 NOT NULL,
                "leaguePoints" integer DEFAULT 0 NOT NULL,
                "tournamentPoints" integer DEFAULT 0 NOT NULL,
                "matchesWon" integer DEFAULT 0 NOT NULL,
                "matchesLost" integer DEFAULT 0 NOT NULL,
                "gamesWon" integer DEFAULT 0 NOT NULL,
                "gamesLost" integer DEFAULT 0 NOT NULL,
                "tournamentsPlayed" integer DEFAULT 0 NOT NULL,
                "leaguesPlayed" integer DEFAULT 0 NOT NULL,
                "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
                "playerId" uuid,
                "clubId" uuid,
                "freePlayPoints" integer DEFAULT 0
            )
        `);

        // 3. Create indexes
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "court_blocks_clubId_startDate_endDate_idx"
                ON ${s}."court_blocks" USING btree ("clubId", "startDate", "endDate");
            CREATE INDEX IF NOT EXISTS "courts_clubId_idx"
                ON ${s}."courts" USING btree ("clubId");
            CREATE UNIQUE INDEX IF NOT EXISTS "player_club_stats_playerId_clubId_idx"
                ON ${s}."player_club_stats" USING btree ("playerId", "clubId");
            CREATE INDEX IF NOT EXISTS "reservations_clubId_date_idx"
                ON ${s}."reservations" USING btree ("clubId", date);
            CREATE INDEX IF NOT EXISTS "reservations_courtId_date_idx"
                ON ${s}."reservations" USING btree ("courtId", date);
        `);

        // 4. Create intra-schema foreign keys
        await this.dataSource.query(`
            ALTER TABLE ${s}."teams"
                ADD CONSTRAINT fk_teams_tournamentid
                FOREIGN KEY ("tournamentId") REFERENCES ${s}."tournaments"(id) ON DELETE CASCADE;

            ALTER TABLE ${s}."matches"
                ADD CONSTRAINT fk_matches_tournamentid
                FOREIGN KEY ("tournamentId") REFERENCES ${s}."tournaments"(id) ON DELETE CASCADE;
            ALTER TABLE ${s}."matches"
                ADD CONSTRAINT fk_matches_team1id
                FOREIGN KEY ("team1Id") REFERENCES ${s}."teams"(id) ON DELETE SET NULL;
            ALTER TABLE ${s}."matches"
                ADD CONSTRAINT fk_matches_team2id
                FOREIGN KEY ("team2Id") REFERENCES ${s}."teams"(id) ON DELETE SET NULL;
            ALTER TABLE ${s}."matches"
                ADD CONSTRAINT fk_matches_winnerid
                FOREIGN KEY ("winnerId") REFERENCES ${s}."teams"(id) ON DELETE SET NULL;

            ALTER TABLE ${s}."league_teams"
                ADD CONSTRAINT fk_league_teams_leagueid
                FOREIGN KEY ("leagueId") REFERENCES ${s}."leagues"(id) ON DELETE CASCADE;

            ALTER TABLE ${s}."league_matches"
                ADD CONSTRAINT fk_league_matches_leagueid
                FOREIGN KEY ("leagueId") REFERENCES ${s}."leagues"(id) ON DELETE CASCADE;
            ALTER TABLE ${s}."league_matches"
                ADD CONSTRAINT fk_league_matches_team1id
                FOREIGN KEY ("team1Id") REFERENCES ${s}."league_teams"(id) ON DELETE SET NULL;
            ALTER TABLE ${s}."league_matches"
                ADD CONSTRAINT fk_league_matches_team2id
                FOREIGN KEY ("team2Id") REFERENCES ${s}."league_teams"(id) ON DELETE SET NULL;
            ALTER TABLE ${s}."league_matches"
                ADD CONSTRAINT fk_league_matches_winnerid
                FOREIGN KEY ("winnerId") REFERENCES ${s}."league_teams"(id) ON DELETE SET NULL;

            ALTER TABLE ${s}."court_price_blocks"
                ADD CONSTRAINT fk_court_price_blocks_courtid
                FOREIGN KEY ("courtId") REFERENCES ${s}."courts"(id) ON DELETE CASCADE;

            ALTER TABLE ${s}."reservations"
                ADD CONSTRAINT fk_reservations_courtid
                FOREIGN KEY ("courtId") REFERENCES ${s}."courts"(id) ON DELETE CASCADE;

            ALTER TABLE ${s}."free_play_matches"
                ADD CONSTRAINT fk_free_play_matches_reservationid
                FOREIGN KEY ("reservationId") REFERENCES ${s}."reservations"(id) ON DELETE CASCADE;

            ALTER TABLE ${s}."mercadopago_payments"
                ADD CONSTRAINT fk_mercadopago_payments_reservationid
                FOREIGN KEY ("reservationId") REFERENCES ${s}."reservations"(id) ON DELETE CASCADE;
        `);

        this.logger.log(`Schema ${s} initialised successfully with 13 tables.`);
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
