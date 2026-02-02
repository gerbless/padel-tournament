import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePersonalMatchesResultEnum1706899100000 implements MigrationInterface {
    name = 'CreatePersonalMatchesResultEnum1706899100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create the enum type for personal matches result
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "personal_matches_result_enum" AS ENUM('win', 'loss');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the enum type (careful: this will fail if the enum is in use)
        await queryRunner.query(`
            DROP TYPE IF EXISTS "personal_matches_result_enum";
        `);
    }
}
