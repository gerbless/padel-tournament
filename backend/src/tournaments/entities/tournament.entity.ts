import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { Match } from '../../matches/entities/match.entity';
import { Club } from '../../clubs/entities/club.entity';

export enum TournamentType {
    CUADRANGULAR = 'cuadrangular', // 4 teams (1 court)
    HEXAGONAL = 'hexagonal',       // 6 teams (1 court)
    OCTAGONAL = 'octagonal',       // 8 teams (2 courts)
    DECAGONAL = 'decagonal',       // 10 teams (2 courts)
    DODECAGONAL = 'dodecagonal',   // 12 teams (3 courts)
}

export enum TournamentStatus {
    DRAFT = 'draft',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed'
}

export enum DurationMode {
    FIXED = 'fixed',       // 1:30 fixed time — groups with N matches each
    FREE = 'free',         // Free time — progressive elimination
}

@Entity('tournaments')
export class Tournament {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({
        type: 'enum',
        enum: TournamentType
    })
    type: TournamentType;

    @Column({
        type: 'enum',
        enum: TournamentStatus,
        default: TournamentStatus.DRAFT
    })
    status: TournamentStatus;

    @Column({ type: 'int', default: 1 })
    courts: number;

    @Column({
        type: 'enum',
        enum: DurationMode,
        default: DurationMode.FREE
    })
    durationMode: DurationMode;

    @Column({ type: 'int', nullable: true })
    durationMinutes: number;

    @Column({ type: 'int', nullable: true })
    matchesPerTeam: number;

    @Column({ type: 'int', nullable: true })
    totalGroups: number;

    @OneToMany(() => Team, team => team.tournament, { cascade: true })
    teams: Team[];

    @OneToMany(() => Match, match => match.tournament, { cascade: true })
    matches: Match[];

    @ManyToOne(() => Club, club => club.tournaments)
    club: Club;

    @Column({ nullable: true })
    clubId: string;

    @Column({ type: 'jsonb', nullable: true })
    config: {
        strictScoring?: boolean;
        allowTies?: boolean;
        pointsForWin?: number;
        pointsForTie?: number;
        pointsForLoss?: number;
    };

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
