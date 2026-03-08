/**
 * Multi-schema data migration script (pure SQL — no entity imports).
 *
 * For each existing club:
 *   1. Generates a deterministic schema name (club_<uuid>)
 *   2. Creates the PostgreSQL schema with all club-scoped tables
 *      (cloned from public schema via CREATE TABLE ... LIKE)
 *   3. Copies data from public-schema tables into the club schema
 *   4. Updates the club record with the schemaName
 *
 * Usage (inside Docker — RECOMMENDED):
 *   docker exec -it padel-tournament-app node dist/scripts/migrate-to-multi-schema.js
 *
 * Usage (local):
 *   cd backend && npx ts-node src/scripts/migrate-to-multi-schema.ts
 *
 * The script is IDEMPOTENT — clubs that already have a schemaName are skipped.
 * No TypeORM entity imports required — works with compiled JS directly.
 */

// Use require so it works both as .ts (ts-node) and compiled .js (node)
const { DataSource } = require('typeorm');
try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }

/** Tables that live in per-club schemas. Order matters for FK dependencies. */
const CLUB_TABLES = [
    'tournaments',
    'teams',
    'matches',
    'leagues',
    'league_teams',
    'league_matches',
    'courts',
    'court_price_blocks',
    'court_blocks',
    'reservations',
    'free_play_matches',
    'mercadopago_payments',
    'player_club_stats',
];

// ── Tables with direct clubId column ─────────────────────────────────
const TABLES_WITH_CLUB_ID: { table: string; fk: string }[] = [
    { table: 'tournaments', fk: '"clubId"' },
    { table: 'courts', fk: '"clubId"' },
    { table: 'court_blocks', fk: '"clubId"' },
    { table: 'reservations', fk: '"clubId"' },
    { table: 'free_play_matches', fk: '"clubId"' },
    { table: 'mercadopago_payments', fk: '"clubId"' },
    { table: 'leagues', fk: '"clubId"' },
];

// ── Tables linked via parent (no clubId, need JOIN) ──────────────────
interface DependentTable {
    table: string;
    parentTable: string;
    parentFk: string;        // FK column in this table pointing to parent
    parentClubFk: string;    // FK column in parent table pointing to club
}

const DEPENDENT_TABLES: DependentTable[] = [
    // teams → tournaments (tournamentId → tournaments.clubId)
    { table: 'teams', parentTable: 'tournaments', parentFk: '"tournamentId"', parentClubFk: '"clubId"' },
    // matches → teams → tournaments
    { table: 'matches', parentTable: 'teams', parentFk: '"team1Id"', parentClubFk: '"tournamentId"' },
    // court_price_blocks → courts
    { table: 'court_price_blocks', parentTable: 'courts', parentFk: '"courtId"', parentClubFk: '"clubId"' },
    // league_teams → leagues
    { table: 'league_teams', parentTable: 'leagues', parentFk: '"leagueId"', parentClubFk: '"clubId"' },
    // league_matches → leagues
    { table: 'league_matches', parentTable: 'leagues', parentFk: '"leagueId"', parentClubFk: '"clubId"' },
    // player_club_stats via club relation
];

function generateSchemaName(clubId: string): string {
    return `club_${clubId.replace(/-/g, '_')}`;
}

async function main() {
    console.log('🏗️  Multi-schema migration starting…\n');

    const ds = new (DataSource as any)({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: +(process.env.DB_PORT || 5432),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'padel_tournament',
        synchronize: false,
        logging: false,
    });

    await ds.initialize();
    console.log('✅ Connected to database\n');

    try {
        // 0. Ensure schemaName column exists
        await ds.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'schemaName'
                ) THEN
                    ALTER TABLE public.clubs ADD COLUMN "schemaName" varchar UNIQUE DEFAULT NULL;
                END IF;
            END $$;
        `);

        // 1. Get all clubs without a schema
        const clubs: { id: string; name: string }[] = await ds.query(
            `SELECT id, name FROM public.clubs WHERE "schemaName" IS NULL ORDER BY "createdAt"`,
        );

        if (clubs.length === 0) {
            console.log('ℹ️  All clubs already have schemas. Nothing to migrate.');
            return;
        }

        console.log(`📦 Found ${clubs.length} club(s) to migrate:\n`);

        for (const club of clubs) {
            const schemaName = generateSchemaName(club.id);
            console.log(`\n── Club: "${club.name}" (${club.id}) ──────`);
            console.log(`   Schema: ${schemaName}`);

            // 2. Create schema
            await ds.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

            // 3. Clone tables from public schema using LIKE (no entity imports needed!)
            for (const table of CLUB_TABLES) {
                const tableExists = await ds.query(
                    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
                    [table],
                );
                if (!tableExists[0]?.exists) {
                    console.log(`   ⚠️  Table public."${table}" does not exist, skipping`);
                    continue;
                }

                const alreadyCreated = await ds.query(
                    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)`,
                    [schemaName, table],
                );
                if (alreadyCreated[0]?.exists) continue;

                await ds.query(`
                    CREATE TABLE "${schemaName}"."${table}"
                    (LIKE public."${table}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)
                `);
            }
            console.log('   ✅ Schema tables created (cloned from public)');

            // 4. Copy data for tables with direct clubId
            for (const { table, fk } of TABLES_WITH_CLUB_ID) {
                const exists = await ds.query(
                    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
                    [table],
                );
                if (!exists[0]?.exists) continue;

                const count = await ds.query(
                    `SELECT count(*) as c FROM public."${table}" WHERE ${fk} = $1`,
                    [club.id],
                );
                const n = parseInt(count[0]?.c || '0');
                if (n === 0) continue;

                const cols = await ds.query(`
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = $1 AND table_name = $2
                    ORDER BY ordinal_position
                `, [schemaName, table]);
                const colNames = cols.map((c: any) => `"${c.column_name}"`).join(', ');

                await ds.query(`
                    INSERT INTO "${schemaName}"."${table}" (${colNames})
                    SELECT ${colNames} FROM public."${table}" WHERE ${fk} = $1
                    ON CONFLICT DO NOTHING
                `, [club.id]);

                console.log(`   📄 ${table}: ${n} row(s) copied`);
            }

            // 5. Copy player_club_stats (uses "clubId" column)
            {
                const countRes = await ds.query(
                    `SELECT count(*) as c FROM public."player_club_stats" WHERE "clubId" = $1`,
                    [club.id],
                );
                const n = parseInt(countRes[0]?.c || '0');
                if (n > 0) {
                    const cols = await ds.query(`
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = $1 AND table_name = 'player_club_stats'
                        ORDER BY ordinal_position
                    `, [schemaName]);
                    const colNames = cols.map((c: any) => `"${c.column_name}"`).join(', ');

                    await ds.query(`
                        INSERT INTO "${schemaName}"."player_club_stats" (${colNames})
                        SELECT ${colNames} FROM public."player_club_stats" WHERE "clubId" = $1
                        ON CONFLICT DO NOTHING
                    `, [club.id]);
                    console.log(`   📄 player_club_stats: ${n} row(s) copied`);
                }
            }

            // 6. Copy dependent tables (teams, matches, price_blocks, league_teams, league_matches)
            // teams → via tournaments.clubId
            {
                const countRes = await ds.query(`
                    SELECT count(*) as c FROM public."teams" t
                    JOIN public."tournaments" tr ON t."tournamentId" = tr.id
                    WHERE tr."clubId" = $1
                `, [club.id]);
                const n = parseInt(countRes[0]?.c || '0');
                if (n > 0) {
                    const cols = await ds.query(`
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = $1 AND table_name = 'teams'
                        ORDER BY ordinal_position
                    `, [schemaName]);
                    const colNames = cols.map((c: any) => `"${c.column_name}"`).join(', ');
                    const selectCols = cols.map((c: any) => `t."${c.column_name}"`).join(', ');

                    await ds.query(`
                        INSERT INTO "${schemaName}"."teams" (${colNames})
                        SELECT ${selectCols} FROM public."teams" t
                        JOIN public."tournaments" tr ON t."tournamentId" = tr.id
                        WHERE tr."clubId" = $1
                        ON CONFLICT DO NOTHING
                    `, [club.id]);
                    console.log(`   📄 teams: ${n} row(s) copied`);
                }
            }

            // matches → via teams → tournaments.clubId
            {
                const countRes = await ds.query(`
                    SELECT count(*) as c FROM public."matches" m
                    JOIN public."teams" t ON m."team1Id" = t.id
                    JOIN public."tournaments" tr ON t."tournamentId" = tr.id
                    WHERE tr."clubId" = $1
                `, [club.id]);
                const n = parseInt(countRes[0]?.c || '0');
                if (n > 0) {
                    const cols = await ds.query(`
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = $1 AND table_name = 'matches'
                        ORDER BY ordinal_position
                    `, [schemaName]);
                    const colNames = cols.map((c: any) => `"${c.column_name}"`).join(', ');
                    const selectCols = cols.map((c: any) => `m."${c.column_name}"`).join(', ');

                    await ds.query(`
                        INSERT INTO "${schemaName}"."matches" (${colNames})
                        SELECT ${selectCols} FROM public."matches" m
                        JOIN public."teams" t ON m."team1Id" = t.id
                        JOIN public."tournaments" tr ON t."tournamentId" = tr.id
                        WHERE tr."clubId" = $1
                        ON CONFLICT DO NOTHING
                    `, [club.id]);
                    console.log(`   📄 matches: ${n} row(s) copied`);
                }
            }

            // court_price_blocks → via courts.clubId
            {
                const countRes = await ds.query(`
                    SELECT count(*) as c FROM public."court_price_blocks" cpb
                    JOIN public."courts" c ON cpb."courtId" = c.id
                    WHERE c."clubId" = $1
                `, [club.id]);
                const n = parseInt(countRes[0]?.c || '0');
                if (n > 0) {
                    const cols = await ds.query(`
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = $1 AND table_name = 'court_price_blocks'
                        ORDER BY ordinal_position
                    `, [schemaName]);
                    const colNames = cols.map((c: any) => `"${c.column_name}"`).join(', ');
                    const selectCols = cols.map((c: any) => `cpb."${c.column_name}"`).join(', ');

                    await ds.query(`
                        INSERT INTO "${schemaName}"."court_price_blocks" (${colNames})
                        SELECT ${selectCols} FROM public."court_price_blocks" cpb
                        JOIN public."courts" c ON cpb."courtId" = c.id
                        WHERE c."clubId" = $1
                        ON CONFLICT DO NOTHING
                    `, [club.id]);
                    console.log(`   📄 court_price_blocks: ${n} row(s) copied`);
                }
            }

            // league_teams → via leagues.clubId
            {
                const countRes = await ds.query(`
                    SELECT count(*) as c FROM public."league_teams" lt
                    JOIN public."leagues" l ON lt."leagueId" = l.id
                    WHERE l."clubId" = $1
                `, [club.id]);
                const n = parseInt(countRes[0]?.c || '0');
                if (n > 0) {
                    const cols = await ds.query(`
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = $1 AND table_name = 'league_teams'
                        ORDER BY ordinal_position
                    `, [schemaName]);
                    const colNames = cols.map((c: any) => `"${c.column_name}"`).join(', ');
                    const selectCols = cols.map((c: any) => `lt."${c.column_name}"`).join(', ');

                    await ds.query(`
                        INSERT INTO "${schemaName}"."league_teams" (${colNames})
                        SELECT ${selectCols} FROM public."league_teams" lt
                        JOIN public."leagues" l ON lt."leagueId" = l.id
                        WHERE l."clubId" = $1
                        ON CONFLICT DO NOTHING
                    `, [club.id]);
                    console.log(`   📄 league_teams: ${n} row(s) copied`);
                }
            }

            // league_matches → via leagues.clubId
            {
                const countRes = await ds.query(`
                    SELECT count(*) as c FROM public."league_matches" lm
                    JOIN public."leagues" l ON lm."leagueId" = l.id
                    WHERE l."clubId" = $1
                `, [club.id]);
                const n = parseInt(countRes[0]?.c || '0');
                if (n > 0) {
                    const cols = await ds.query(`
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = $1 AND table_name = 'league_matches'
                        ORDER BY ordinal_position
                    `, [schemaName]);
                    const colNames = cols.map((c: any) => `"${c.column_name}"`).join(', ');
                    const selectCols = cols.map((c: any) => `lm."${c.column_name}"`).join(', ');

                    await ds.query(`
                        INSERT INTO "${schemaName}"."league_matches" (${colNames})
                        SELECT ${selectCols} FROM public."league_matches" lm
                        JOIN public."leagues" l ON lm."leagueId" = l.id
                        WHERE l."clubId" = $1
                        ON CONFLICT DO NOTHING
                    `, [club.id]);
                    console.log(`   📄 league_matches: ${n} row(s) copied`);
                }
            }

            // 7. Update club record with schemaName
            await ds.query(
                `UPDATE public.clubs SET "schemaName" = $1 WHERE id = $2`,
                [schemaName, club.id],
            );
            console.log(`   ✅ Club updated with schemaName`);
        }

        // 8. Optional: Delete migrated data from public tables (commented out for safety)
        console.log('\n\n🔒 Data has been COPIED but NOT deleted from public tables.');
        console.log('   To remove duplicated data from public tables, uncomment the');
        console.log('   cleanup section in this script and re-run.');
        console.log('   ⚠️  BACK UP YOUR DATABASE FIRST!\n');

        /*
        // ── CLEANUP: Remove migrated data from public tables ──────────
        // Run this ONLY after verifying the migration worked correctly.
        const migratedClubs: { id: string }[] = await ds.query(
            `SELECT id FROM public.clubs WHERE "schemaName" IS NOT NULL`,
        );
        for (const club of migratedClubs) {
            // Delete in reverse dependency order
            // matches → teams → tournaments
            await ds.query(`
                DELETE FROM public."matches" WHERE "team1Id" IN (
                    SELECT t.id FROM public."teams" t
                    JOIN public."tournaments" tr ON t."tournamentId" = tr.id
                    WHERE tr."clubId" = $1
                )
            `, [club.id]);
            await ds.query(`
                DELETE FROM public."league_matches" WHERE "leagueId" IN (
                    SELECT id FROM public."leagues" WHERE "clubId" = $1
                )
            `, [club.id]);
            await ds.query(`
                DELETE FROM public."league_teams" WHERE "leagueId" IN (
                    SELECT id FROM public."leagues" WHERE "clubId" = $1
                )
            `, [club.id]);
            await ds.query(`
                DELETE FROM public."court_price_blocks" WHERE "courtId" IN (
                    SELECT id FROM public."courts" WHERE "clubId" = $1
                )
            `, [club.id]);
            await ds.query(`
                DELETE FROM public."teams" WHERE "tournamentId" IN (
                    SELECT id FROM public."tournaments" WHERE "clubId" = $1
                )
            `, [club.id]);

            // Direct clubId tables
            for (const { table, fk } of TABLES_WITH_CLUB_ID) {
                await ds.query(`DELETE FROM public."${table}" WHERE ${fk} = $1`, [club.id]);
            }
            await ds.query(`DELETE FROM public."player_club_stats" WHERE "clubId" = $1`, [club.id]);
        }
        console.log('🧹 Public table cleanup complete.');
        */

        console.log('✅ Migration complete!');
    } finally {
        await ds.destroy();
    }
}

main().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
