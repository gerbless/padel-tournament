import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEnablePaymentsToClubs1741375200000 implements MigrationInterface {
    name = 'AddEnablePaymentsToClubs1741375200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS "enablePayments" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE clubs DROP COLUMN IF EXISTS "enablePayments"`);
    }
}
