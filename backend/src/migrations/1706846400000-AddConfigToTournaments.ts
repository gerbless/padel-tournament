import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConfigToTournaments1706846400000 implements MigrationInterface {
    name = 'AddConfigToTournaments1706846400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if column exists before adding to avoid errors if synchronize already ran
        const table = await queryRunner.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tournaments' AND column_name='config'`);
        if (table.length === 0) {
            await queryRunner.query(`ALTER TABLE "tournaments" ADD "config" jsonb`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "config"`);
    }
}
