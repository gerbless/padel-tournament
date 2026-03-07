import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClubFeatureFlags1739800000000 implements MigrationInterface {
    name = 'AddClubFeatureFlags1739800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const cols = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name='clubs' AND column_name IN ('enablePhoneVerification','enablePaymentLinkSending')`
        );
        const existing = cols.map((c: any) => c.column_name);

        if (!existing.includes('enablePhoneVerification')) {
            await queryRunner.query(
                `ALTER TABLE "clubs" ADD "enablePhoneVerification" boolean NOT NULL DEFAULT false`
            );
        }
        if (!existing.includes('enablePaymentLinkSending')) {
            await queryRunner.query(
                `ALTER TABLE "clubs" ADD "enablePaymentLinkSending" boolean NOT NULL DEFAULT false`
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clubs" DROP COLUMN IF EXISTS "enablePhoneVerification"`);
        await queryRunner.query(`ALTER TABLE "clubs" DROP COLUMN IF EXISTS "enablePaymentLinkSending"`);
    }
}
