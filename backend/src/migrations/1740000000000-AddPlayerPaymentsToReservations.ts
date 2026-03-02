import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlayerPaymentsToReservations1740000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "reservations"
            ADD COLUMN IF NOT EXISTS "playerPayments" jsonb
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "reservations"
            DROP COLUMN IF EXISTS "playerPayments"
        `);
    }
}
