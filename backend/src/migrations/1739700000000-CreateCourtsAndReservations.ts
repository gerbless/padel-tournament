import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourtsAndReservations1739700000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enums
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "reservation_status_enum" AS ENUM ('pending', 'confirmed', 'cancelled');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "price_type_enum" AS ENUM ('full_court', 'per_player');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "payment_status_enum" AS ENUM ('pending', 'paid', 'partial');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create courts table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "courts" (
                "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
                "clubId" uuid NOT NULL,
                "name" varchar NOT NULL,
                "courtNumber" int NOT NULL,
                "surfaceType" varchar,
                "isActive" boolean DEFAULT true,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_courts" PRIMARY KEY ("id"),
                CONSTRAINT "FK_courts_club" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE
            );
        `);

        // Create court_price_blocks table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "court_price_blocks" (
                "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
                "courtId" uuid NOT NULL,
                "daysOfWeek" jsonb DEFAULT '[]'::jsonb,
                "startTime" varchar NOT NULL,
                "endTime" varchar NOT NULL,
                "priceFullCourt" decimal(10,2) DEFAULT 0,
                "pricePerPlayer" decimal(10,2) DEFAULT 0,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_court_price_blocks" PRIMARY KEY ("id"),
                CONSTRAINT "FK_price_blocks_court" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE CASCADE
            );
        `);

        // Create reservations table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "reservations" (
                "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
                "courtId" uuid NOT NULL,
                "clubId" uuid NOT NULL,
                "date" date NOT NULL,
                "startTime" varchar NOT NULL,
                "endTime" varchar NOT NULL,
                "title" varchar,
                "status" "reservation_status_enum" DEFAULT 'confirmed',
                "players" jsonb DEFAULT '[]'::jsonb,
                "playerCount" int DEFAULT 4,
                "priceType" "price_type_enum" DEFAULT 'full_court',
                "basePrice" decimal(10,2) DEFAULT 0,
                "finalPrice" decimal(10,2) DEFAULT 0,
                "paymentStatus" "payment_status_enum" DEFAULT 'pending',
                "paymentNotes" text,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_reservations" PRIMARY KEY ("id"),
                CONSTRAINT "FK_reservations_court" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_reservations_club" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE
            );
        `);

        // Add enableCourtPricing to clubs
        await queryRunner.query(`
            ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "enableCourtPricing" boolean DEFAULT false;
        `);

        // Create indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_courts_clubId" ON "courts" ("clubId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reservations_courtId_date" ON "reservations" ("courtId", "date");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reservations_clubId_date" ON "reservations" ("clubId", "date");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "reservations";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "court_price_blocks";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "courts";`);
        await queryRunner.query(`ALTER TABLE "clubs" DROP COLUMN IF EXISTS "enableCourtPricing";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "payment_status_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "price_type_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "reservation_status_enum";`);
    }
}
