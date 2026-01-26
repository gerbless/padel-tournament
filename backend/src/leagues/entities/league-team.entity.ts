import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { League } from './league.entity';
import { Player } from '../../players/entities/player.entity';
import { LeagueMatch } from './league-match.entity';

@Entity('league_teams')
export class LeagueTeam {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    leagueId: string;

    @Column()
    player1Id: string;

    @Column()
    player2Id: string;

    @Column({ nullable: true })
    teamName: string;

    // League specific stats
    @Column({ default: 0 })
    matchesPlayed: number;

    @Column({ default: 0 })
    matchesWon: number;

    @Column({ default: 0 })
    matchesLost: number;

    @Column({ default: 0 })
    points: number;

    @Column({ default: 0 })
    setsWon: number;

    @Column({ default: 0 })
    setsLost: number;

    @Column({ default: 0 })
    gamesWon: number;

    @Column({ default: 0 })
    gamesLost: number;

    // For group stage
    @Column({ nullable: true })
    group: string;

    @ManyToOne(() => League, league => league.teams, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'leagueId' })
    league: League;

    @ManyToOne(() => Player)
    @JoinColumn({ name: 'player1Id' })
    player1: Player;

    @ManyToOne(() => Player)
    @JoinColumn({ name: 'player2Id' })
    player2: Player;

    @OneToMany(() => LeagueMatch, match => match.team1)
    matchesAsTeam1: LeagueMatch[];

    @OneToMany(() => LeagueMatch, match => match.team2)
    matchesAsTeam2: LeagueMatch[];
}
