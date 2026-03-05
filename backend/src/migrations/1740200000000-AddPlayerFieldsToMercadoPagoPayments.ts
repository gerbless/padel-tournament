import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlayerFieldsToMercadoPagoPayments1740200000000 implements MigrationInterface {
    name = 'AddPlayerFieldsToMercadoPagoPayments1740200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add playerIndex column (int, nullable) for per-player payments (0-3)
        await queryRunner.query(`
            ALTER TABLE "mercadopago_payments"
            ADD COLUMN IF NOT EXISTS "playerIndex" integer
        `);

        // Add playerName column (varchar, nullable)
        await queryRunner.query(`
            ALTER TABLE "mercadopago_payments"
            ADD COLUMN IF NOT EXISTS "playerName" varchar
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "mercadopago_payments" DROP COLUMN IF EXISTS "playerName"
        `);
        await queryRunner.query(`
            ALTER TABLE "mercadopago_payments" DROP COLUMN IF EXISTS "playerIndex"
        `);
    }
}
