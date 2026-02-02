import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusToPersonalMatches1738523200000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add status column with default value 'draft'
        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'draft'
        `);

        // Make result column nullable
        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            ALTER COLUMN "result" DROP NOT NULL
        `);

        // Make sets column default to empty array
        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            ALTER COLUMN "sets" SET DEFAULT '[]'::jsonb
        `);

        // Update existing records to set status to 'completed' if they have a result
        await queryRunner.query(`
            UPDATE "personal_matches" 
            SET "status" = 'completed' 
            WHERE "result" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            DROP COLUMN IF EXISTS "status"
        `);

        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            ALTER COLUMN "result" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            ALTER COLUMN "sets" DROP DEFAULT
        `);
    }
}
