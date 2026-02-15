import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserClubRoles1738600000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create user_club_roles table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_club_roles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "clubId" uuid NOT NULL,
                "role" varchar NOT NULL DEFAULT 'viewer',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_club_roles" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_club_roles_user_club" UNIQUE ("userId", "clubId"),
                CONSTRAINT "FK_user_club_roles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_user_club_roles_club" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE
            )
        `);

        // Create index for faster lookups
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_club_roles_userId" ON "user_club_roles" ("userId")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_club_roles_clubId" ON "user_club_roles" ("clubId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_club_roles_clubId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_club_roles_userId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_club_roles"`);
    }
}
