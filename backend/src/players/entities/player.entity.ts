import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { LeagueTeam } from '../../leagues/entities/league-team.entity';
import { Category } from '../../categories/entities/category.entity';
import { ManyToOne } from 'typeorm';

@Entity('players')
export class Player {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

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

    @CreateDateColumn()
    createdAt: string;

    @UpdateDateColumn()
    updatedAt: string;
}
