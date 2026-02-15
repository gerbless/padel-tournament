import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoundRobinPlayoffType1739600000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new enum value to leagues_type_enum
        // PostgreSQL requires ALTER TYPE to add new enum values
        const enumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'leagues_type_enum'
            );
        `);

        if (enumExists[0].exists) {
            // Check if value already exists
            const valueExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT 1 FROM pg_enum 
                    WHERE enumlabel = 'round_robin_playoff' 
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'leagues_type_enum')
                );
            `);

            if (!valueExists[0].exists) {
                await queryRunner.query(`
                    ALTER TYPE "leagues_type_enum" ADD VALUE 'round_robin_playoff';
                `);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL doesn't support removing enum values easily
        // Would need to recreate the type, which is destructive
        console.log('Cannot remove enum value - manual intervention required');
    }
}
