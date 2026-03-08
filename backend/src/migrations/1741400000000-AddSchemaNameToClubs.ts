import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchemaNameToClubs1741400000000 implements MigrationInterface {
    name = 'AddSchemaNameToClubs1741400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clubs
            ADD COLUMN IF NOT EXISTS "schemaName" varchar UNIQUE DEFAULT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE clubs DROP COLUMN IF EXISTS "schemaName"`);
    }
}
