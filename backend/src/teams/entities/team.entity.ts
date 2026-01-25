import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Match } from '../../matches/entities/match.entity';

@Entity('teams')
export class Team {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    player1Name: string;

    @Column()
    player2Name: string;

    @Column()
    tournamentId: string;

    @ManyToOne(() => Tournament, tournament => tournament.teams, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'tournamentId' })
    tournament: Tournament;

    @OneToMany(() => Match, match => match.team1)
    matchesAsTeam1: Match[];

    @OneToMany(() => Match, match => match.team2)
    matchesAsTeam2: Match[];
}
