import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnabledModulesToClubs1740100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "clubs"
            ADD COLUMN IF NOT EXISTS "enabledModules" jsonb
            NOT NULL
            DEFAULT '{"dashboard":true,"tournaments":true,"leagues":true,"courts":true,"players":true,"ranking":true,"estadisticas":true}'::jsonb
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "clubs" DROP COLUMN IF EXISTS "enabledModules"
        `);
    }
}
