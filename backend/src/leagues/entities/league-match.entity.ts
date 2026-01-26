import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { League } from './league.entity';
import { LeagueTeam } from './league-team.entity';

export enum MatchStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed'
}

export interface SetResult {
    team1Games: number;
    team2Games: number;
    pairAGames?: number; // From frontend
    pairBGames?: number; // From frontend
    tiebreak?: {
        team1Points: number;
        team2Points: number;
    };
}

@Entity('league_matches')
export class LeagueMatch {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    leagueId: string;

    @Column()
    team1Id: string;

    @Column()
    team2Id: string;

    @Column()
    round: number;

    @Column({ nullable: true })
    group: string; // "A", "B", or "Playoff_QF", etc.

    @Column({
        type: 'enum',
        enum: MatchStatus,
        default: MatchStatus.PENDING
    })
    status: MatchStatus;

    @Column({ type: 'jsonb', nullable: true })
    sets: SetResult[];

    @Column({ nullable: true })
    winnerId: string;

    @Column({ nullable: true })
    matchDate: Date;

    @ManyToOne(() => League, league => league.matches, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'leagueId' })
    league: League;

    @ManyToOne(() => LeagueTeam, team => team.matchesAsTeam1)
    @JoinColumn({ name: 'team1Id' })
    team1: LeagueTeam;

    @ManyToOne(() => LeagueTeam, team => team.matchesAsTeam2)
    @JoinColumn({ name: 'team2Id' })
    team2: LeagueTeam;

    @ManyToOne(() => LeagueTeam, { nullable: true })
    @JoinColumn({ name: 'winnerId' })
    winner: LeagueTeam;
}
