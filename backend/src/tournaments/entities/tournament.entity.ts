import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { Match } from '../../matches/entities/match.entity';
import { Club } from '../../clubs/entities/club.entity';

export enum TournamentType {
    CUADRANGULAR = 'cuadrangular', // 4 teams
    HEXAGONAL = 'hexagonal' // 6 teams
}

export enum TournamentStatus {
    DRAFT = 'draft',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed'
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
