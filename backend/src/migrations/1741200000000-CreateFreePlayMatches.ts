import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFreePlayMatches1741200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create free_play_matches table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "free_play_matches" (
                "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
                "reservationId" uuid,
                "clubId" uuid,
                "date" date NOT NULL,
                "team1PlayerIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "team2PlayerIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "team1Names" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "team2Names" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "sets" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "winner" int,
                "countsForRanking" boolean NOT NULL DEFAULT true,
                "pointsPerWin" int NOT NULL DEFAULT 3,
                "status" varchar NOT NULL DEFAULT 'pending',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_free_play_matches" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_free_play_matches_reservation" UNIQUE ("reservationId"),
                CONSTRAINT "FK_free_play_matches_reservation" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL,
                CONSTRAINT "FK_free_play_matches_club" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL
            );
        `);

        // Add freePlayPoints column to players
        await queryRunner.query(`
            ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "freePlayPoints" int DEFAULT 0;
        `);

        // Add freePlayPoints column to player_club_stats
        await queryRunner.query(`
            ALTER TABLE "player_club_stats" ADD COLUMN IF NOT EXISTS "freePlayPoints" int DEFAULT 0;
        `);

        // Add freePlayPointsPerWin column to clubs
        await queryRunner.query(`
            ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "freePlayPointsPerWin" int DEFAULT 3;
        `);

        // Add countsForRanking column to reservations
        await queryRunner.query(`
            ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "countsForRanking" boolean DEFAULT false;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN IF EXISTS "countsForRanking";`);
        await queryRunner.query(`ALTER TABLE "clubs" DROP COLUMN IF EXISTS "freePlayPointsPerWin";`);
        await queryRunner.query(`ALTER TABLE "player_club_stats" DROP COLUMN IF EXISTS "freePlayPoints";`);
        await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "freePlayPoints";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "free_play_matches";`);
    }
}
