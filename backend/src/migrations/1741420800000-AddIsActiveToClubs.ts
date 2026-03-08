import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsActiveToClubs1741420800000 implements MigrationInterface {
    name = 'AddIsActiveToClubs1741420800000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clubs" DROP COLUMN IF EXISTS "isActive"`);
    }
}
