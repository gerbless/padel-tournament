import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneVerificationFields1740000000000 implements MigrationInterface {
    name = 'AddPhoneVerificationFields1740000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add phone and isPhoneVerified to users table
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "phone" character varying,
            ADD COLUMN IF NOT EXISTS "isPhoneVerified" boolean NOT NULL DEFAULT false
        `);

        // Add phone to players table
        await queryRunner.query(`
            ALTER TABLE "players"
            ADD COLUMN IF NOT EXISTS "phone" character varying
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isPhoneVerified"`);
        await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "phone"`);
    }
}
