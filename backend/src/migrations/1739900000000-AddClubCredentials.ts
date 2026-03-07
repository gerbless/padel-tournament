import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClubCredentials1739900000000 implements MigrationInterface {
    name = 'AddClubCredentials1739900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const cols = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name='clubs' AND column_name='credentials'`
        );
        if (!cols.length) {
            await queryRunner.query(
                `ALTER TABLE "clubs" ADD "credentials" jsonb DEFAULT NULL`
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clubs" DROP COLUMN IF EXISTS "credentials"`);
    }
}
