import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangePersonalMatchOwnerToUser1738523089000 implements MigrationInterface {
    name = 'ChangePersonalMatchOwnerToUser1738523089000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop existing foreign key constraint from players
        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            DROP CONSTRAINT IF EXISTS "FK_old_ownerId_to_players"
        `);

        // Add new foreign key constraint to users
        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            ADD CONSTRAINT "FK_e3f27119354b1d771d3a9412cce" 
            FOREIGN KEY ("ownerId") REFERENCES "users"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert: Drop foreign key to users
        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            DROP CONSTRAINT "FK_e3f27119354b1d771d3a9412cce"
        `);

        // Restore foreign key to players (be careful with existing data!)
        await queryRunner.query(`
            ALTER TABLE "personal_matches" 
            ADD CONSTRAINT "FK_old_ownerId_to_players" 
            FOREIGN KEY ("ownerId") REFERENCES "players"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }
}
