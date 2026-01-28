import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { LeagueTeam } from '../../leagues/entities/league-team.entity';
import { Category } from '../../categories/entities/category.entity';
import { Club } from '../../clubs/entities/club.entity';
import { PlayerClubStats } from './player-club-stats.entity';

@Entity('players')
export class Player {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

    @Column({ nullable: true, unique: true })
    identification: string;

    @Column({ nullable: true, unique: true })
    email: string;

    @Column({ default: 0 })
    totalPoints: number;

    @Column({ default: 0 })
    leaguePoints: number;

    @Column({ nullable: true })
    ranking: number;

    @Column({ default: 0 })
    tournamentPoints: number;

    @Column({ default: 0 })
    matchesWon: number;

    @Column({ default: 0 })
    gamesWon: number;

    @Column({ default: 0 })
    tournamentsPlayed: number;

    @OneToMany(() => Team, team => team.player1)
    teamsAsPlayer1: Team[];

    @OneToMany(() => Team, team => team.player2)
    teamsAsPlayer2: Team[];

    @OneToMany(() => LeagueTeam, team => team.player1)
    leagueTeamsAsPlayer1: LeagueTeam[];

    @OneToMany(() => LeagueTeam, team => team.player2)
    leagueTeamsAsPlayer2: LeagueTeam[];

    @Column({ default: 0 })
    leaguesPlayed: number;

    @ManyToOne(() => Category, category => category.players, { nullable: true })
    category: Category;

    @Column({
        type: 'enum',
        enum: ['reves', 'drive', 'mixto'],
        nullable: true
    })
    position: 'reves' | 'drive' | 'mixto';

    @ManyToMany(() => Club, club => club.players)
    @JoinTable({
        name: 'player_clubs',
        joinColumn: { name: 'player_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'club_id', referencedColumnName: 'id' }
    })
    clubs: Club[];

    @OneToMany(() => PlayerClubStats, clubStats => clubStats.player)
    clubStats: PlayerClubStats[];

    @CreateDateColumn()
    createdAt: string;

    @UpdateDateColumn()
    updatedAt: string;
}
