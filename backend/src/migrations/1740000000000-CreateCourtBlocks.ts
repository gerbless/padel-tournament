import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourtBlocks1740000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create block_type enum
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "block_type_enum" AS ENUM ('full_day', 'morning', 'afternoon', 'night', 'custom');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create court_blocks table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "court_blocks" (
                "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
                "clubId" character varying NOT NULL,
                "startDate" date NOT NULL,
                "endDate" date NOT NULL,
                "blockType" "block_type_enum" NOT NULL DEFAULT 'full_day',
                "customStartTime" character varying,
                "customEndTime" character varying,
                "courtIds" jsonb,
                "reason" character varying NOT NULL DEFAULT '',
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_court_blocks" PRIMARY KEY ("id")
            );
        `);

        // Index for fast lookups by club and date range
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_court_blocks_club_dates" ON "court_blocks" ("clubId", "startDate", "endDate");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "court_blocks";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "block_type_enum";`);
    }
}
