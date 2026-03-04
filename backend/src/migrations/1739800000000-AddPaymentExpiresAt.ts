import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentExpiresAt1739800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add paymentExpiresAt column to reservations
        await queryRunner.query(`
            ALTER TABLE "reservations"
            ADD COLUMN IF NOT EXISTS "paymentExpiresAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL
        `);

        // Change mercadopago_payments FK from SET NULL to CASCADE
        // First drop the existing FK constraint, then re-add with CASCADE
        const fkResult = await queryRunner.query(`
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'mercadopago_payments'
            AND constraint_type = 'FOREIGN KEY'
        `);

        for (const fk of fkResult) {
            await queryRunner.query(`
                ALTER TABLE "mercadopago_payments" DROP CONSTRAINT "${fk.constraint_name}"
            `);
        }

        await queryRunner.query(`
            ALTER TABLE "mercadopago_payments"
            ADD CONSTRAINT "FK_mp_payments_reservation"
            FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN IF EXISTS "paymentExpiresAt"`);
    }
}
