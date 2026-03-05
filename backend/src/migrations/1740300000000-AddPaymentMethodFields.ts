import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodFields1740300000000 implements MigrationInterface {
    name = 'AddPaymentMethodFields1740300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type for payment method
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."reservations_paymentmethod_enum"
                    AS ENUM('cash', 'transfer', 'mercado_pago','red_compras');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Add paymentMethod column to reservations (for full-court payments)
        await queryRunner.query(`
            ALTER TABLE "reservations"
            ADD COLUMN IF NOT EXISTS "paymentMethod" "public"."reservations_paymentmethod_enum"
        `);

        // Add playerId column to mercadopago_payments
        await queryRunner.query(`
            ALTER TABLE "mercadopago_payments"
            ADD COLUMN IF NOT EXISTS "playerId" varchar
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mercadopago_payments" DROP COLUMN IF EXISTS "playerId"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN IF EXISTS "paymentMethod"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."reservations_paymentmethod_enum"`);
    }
}
