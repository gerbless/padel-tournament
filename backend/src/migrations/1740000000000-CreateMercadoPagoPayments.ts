import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMercadoPagoPayments1740000000000 implements MigrationInterface {
    name = 'CreateMercadoPagoPayments1740000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "mercadopago_payment_status_enum" AS ENUM (
                    'pending', 'approved', 'rejected', 'cancelled', 'refunded', 'in_process'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "mercadopago_payments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "reservationId" uuid,
                "clubId" uuid NOT NULL,
                "preferenceId" varchar,
                "mpPaymentId" varchar,
                "externalReference" varchar NOT NULL,
                "amount" decimal(10,2) NOT NULL DEFAULT 0,
                "currency" varchar NOT NULL DEFAULT 'CLP',
                "description" varchar,
                "payerEmail" varchar,
                "status" "mercadopago_payment_status_enum" NOT NULL DEFAULT 'pending',
                "statusDetail" varchar,
                "paymentMethod" varchar,
                "mpData" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_mercadopago_payments" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_mercadopago_payments_externalReference" UNIQUE ("externalReference"),
                CONSTRAINT "FK_mercadopago_payments_reservation" FOREIGN KEY ("reservationId")
                    REFERENCES "reservations"("id") ON DELETE SET NULL
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "mercadopago_payments"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "mercadopago_payment_status_enum"`);
    }
}
