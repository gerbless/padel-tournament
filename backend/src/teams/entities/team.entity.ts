import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Match } from '../../matches/entities/match.entity';
import { Player } from '../../players/entities/player.entity';

@Entity('teams')
export class Team {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    player1Id: string;

    @Column()
    player2Id: string;

    @ManyToOne(() => Player, player => player.teamsAsPlayer1)
    @JoinColumn({ name: 'player1Id' })
    player1: Player;

    @ManyToOne(() => Player, player => player.teamsAsPlayer2)
    @JoinColumn({ name: 'player2Id' })
    player2: Player;

    // Computed properties for backward compatibility
    get player1Name(): string {
        return this.player1?.name || '';
    }

    get player2Name(): string {
        return this.player2?.name || '';
    }

    @Column({ type: 'int', nullable: true })
    groupNumber: number;

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
