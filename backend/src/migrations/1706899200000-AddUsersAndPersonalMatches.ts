import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsersAndPersonalMatches1706899200000 implements MigrationInterface {
    name = 'AddUsersAndPersonalMatches1706899200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure the enum exists (idempotent)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "personal_matches_result_enum" AS ENUM('win', 'loss');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create User table (idempotent)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "role" character varying NOT NULL DEFAULT 'user',
                "playerId" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"),
                CONSTRAINT "FK_Users_Player" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
            )
        `);

        // Create PersonalMatch table (idempotent)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "personal_matches" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "date" TIMESTAMP NOT NULL,
                "ownerId" uuid NOT NULL,
                "partnerId" uuid NOT NULL,
                "rival1Id" uuid NOT NULL,
                "rival2Id" uuid NOT NULL,
                "clubId" uuid,
                "sets" jsonb NOT NULL,
                "result" "public"."personal_matches_result_enum" NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_personal_matches" PRIMARY KEY ("id")
            )
        `);

        // Add FKs for PersonalMatch (idempotent)
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "personal_matches" ADD CONSTRAINT "FK_PersonalMatches_Owner" FOREIGN KEY ("ownerId") REFERENCES "players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "personal_matches" ADD CONSTRAINT "FK_PersonalMatches_Partner" FOREIGN KEY ("partnerId") REFERENCES "players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "personal_matches" ADD CONSTRAINT "FK_PersonalMatches_Rival1" FOREIGN KEY ("rival1Id") REFERENCES "players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "personal_matches" ADD CONSTRAINT "FK_PersonalMatches_Rival2" FOREIGN KEY ("rival2Id") REFERENCES "players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "personal_matches" ADD CONSTRAINT "FK_PersonalMatches_Club" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "personal_matches"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }
}
