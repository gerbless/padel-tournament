import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTournamentWizardFields1738600000000 implements MigrationInterface {
    name = 'AddTournamentWizardFields1738600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add new tournament types to the enum
        await queryRunner.query(`ALTER TYPE "tournaments_type_enum" ADD VALUE IF NOT EXISTS 'octagonal'`);
        await queryRunner.query(`ALTER TYPE "tournaments_type_enum" ADD VALUE IF NOT EXISTS 'decagonal'`);
        await queryRunner.query(`ALTER TYPE "tournaments_type_enum" ADD VALUE IF NOT EXISTS 'dodecagonal'`);

        // 2. Create duration_mode enum
        await queryRunner.query(`CREATE TYPE "tournaments_durationmode_enum" AS ENUM('fixed', 'free')`);

        // 3. Create match_phase enum
        await queryRunner.query(`CREATE TYPE "matches_phase_enum" AS ENUM('group', 'elimination')`);

        // 4. Add new columns to tournaments
        const tourCols = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name='tournaments' AND column_name IN ('courts', 'durationMode', 'durationMinutes', 'matchesPerTeam', 'totalGroups')`
        );
        const existing = tourCols.map((c: any) => c.column_name);

        if (!existing.includes('courts')) {
            await queryRunner.query(`ALTER TABLE "tournaments" ADD "courts" integer NOT NULL DEFAULT 1`);
        }
        if (!existing.includes('durationMode')) {
            await queryRunner.query(`ALTER TABLE "tournaments" ADD "durationMode" "tournaments_durationmode_enum" NOT NULL DEFAULT 'free'`);
        }
        if (!existing.includes('durationMinutes')) {
            await queryRunner.query(`ALTER TABLE "tournaments" ADD "durationMinutes" integer`);
        }
        if (!existing.includes('matchesPerTeam')) {
            await queryRunner.query(`ALTER TABLE "tournaments" ADD "matchesPerTeam" integer`);
        }
        if (!existing.includes('totalGroups')) {
            await queryRunner.query(`ALTER TABLE "tournaments" ADD "totalGroups" integer`);
        }

        // 5. Add new columns to matches
        const matchCols = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name='matches' AND column_name IN ('groupNumber', 'courtNumber', 'round', 'phase')`
        );
        const existingMatch = matchCols.map((c: any) => c.column_name);

        if (!existingMatch.includes('groupNumber')) {
            await queryRunner.query(`ALTER TABLE "matches" ADD "groupNumber" integer`);
        }
        if (!existingMatch.includes('courtNumber')) {
            await queryRunner.query(`ALTER TABLE "matches" ADD "courtNumber" integer`);
        }
        if (!existingMatch.includes('round')) {
            await queryRunner.query(`ALTER TABLE "matches" ADD "round" integer`);
        }
        if (!existingMatch.includes('phase')) {
            await queryRunner.query(`ALTER TABLE "matches" ADD "phase" "matches_phase_enum"`);
        }

        // 6. Add groupNumber to teams
        const teamCols = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name='teams' AND column_name='groupNumber'`
        );
        if (teamCols.length === 0) {
            await queryRunner.query(`ALTER TABLE "teams" ADD "groupNumber" integer`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN IF EXISTS "groupNumber"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN IF EXISTS "phase"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN IF EXISTS "round"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN IF EXISTS "courtNumber"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN IF EXISTS "groupNumber"`);
        await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "totalGroups"`);
        await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "matchesPerTeam"`);
        await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "durationMinutes"`);
        await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "durationMode"`);
        await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "courts"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "matches_phase_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "tournaments_durationmode_enum"`);
        // Note: Cannot easily remove enum values in PostgreSQL, so we leave tournament type values.
    }
}
