import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Team } from '../../teams/entities/team.entity';

export enum MatchStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed'
}

export enum MatchPhase {
    GROUP = 'group',
    ELIMINATION = 'elimination',
}

export interface SetResult {
    team1Games: number;
    team2Games: number;
    tiebreak?: {
        team1Points: number;
        team2Points: number;
    };
}

@Entity('matches')
export class Match {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    tournamentId: string;

    @Column()
    team1Id: string;

    @Column()
    team2Id: string;

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

    @Column({ type: 'int', nullable: true })
    groupNumber: number;

    @Column({ type: 'int', nullable: true })
    courtNumber: number;

    @Column({ type: 'int', nullable: true })
    round: number;

    @Column({
        type: 'enum',
        enum: MatchPhase,
        nullable: true
    })
    phase: MatchPhase;

    @ManyToOne(() => Tournament, tournament => tournament.matches, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'tournamentId' })
    tournament: Tournament;

    @ManyToOne(() => Team, team => team.matchesAsTeam1)
    @JoinColumn({ name: 'team1Id' })
    team1: Team;

    @ManyToOne(() => Team, team => team.matchesAsTeam2)
    @JoinColumn({ name: 'team2Id' })
    team2: Team;

    @ManyToOne(() => Team, { nullable: true })
    @JoinColumn({ name: 'winnerId' })
    winner: Team;
}
