import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransferInfoToClubs1741375300000 implements MigrationInterface {
    name = 'AddTransferInfoToClubs1741375300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS "transferInfo" jsonb DEFAULT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE clubs DROP COLUMN IF EXISTS "transferInfo"`);
    }
}
