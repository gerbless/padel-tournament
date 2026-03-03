import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerification1740000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "emailVerificationToken" varchar NULL
        `);
        // Mark all existing users as verified so they can still login
        await queryRunner.query(`
            UPDATE "users" SET "isEmailVerified" = true WHERE "isEmailVerified" = false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationToken"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isEmailVerified"`);
    }
}
