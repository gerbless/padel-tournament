import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Team } from '../../teams/entities/team.entity';

@Entity('players')
export class Player {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

    @Column({ default: 0 })
    totalPoints: number;

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

    @CreateDateColumn()
    createdAt: string;

    @UpdateDateColumn()
    updatedAt: string;
}
