import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { LeagueTeam } from './league-team.entity';
import { LeagueMatch } from './league-match.entity';
import { Club } from '../../clubs/entities/club.entity';

export enum LeagueType {
    ROUND_ROBIN = 'round_robin',
    GROUPS_PLAYOFF = 'groups_playoff'
}

export enum LeagueStatus {
    DRAFT = 'draft',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed'
}

@Entity('leagues')
export class League {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({
        type: 'enum',
        enum: LeagueType
    })
    type: LeagueType;

    @Column({ type: 'jsonb', default: {} })
    config: {
        pointsForWin?: number;
        pointsForLoss?: number;
        setsPerMatch?: number;
        useGoldenPoint?: boolean;
        groups?: string[]; // For GROUPS_PLAYOFF names
        numberOfGroups?: number; // Added for auto-generation
        teamsAdvancePerGroup?: number; // How many teams advance per group
        enableMultiTierPlayoffs?: boolean; // Gold/Silver/Bronze cups
    };

    @Column({
        type: 'enum',
        enum: LeagueStatus,
        default: LeagueStatus.DRAFT
    })
    status: LeagueStatus;

    @Column({ nullable: true })
    startDate: Date;

    @Column({ nullable: true })
    endDate: Date;

    @OneToMany(() => LeagueTeam, team => team.league, { cascade: true })
    teams: LeagueTeam[];

    @OneToMany(() => LeagueMatch, match => match.league, { cascade: true })
    matches: LeagueMatch[];

    @ManyToOne(() => Club, club => club.leagues)
    club: Club;

    @Column({ nullable: true })
    clubId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
