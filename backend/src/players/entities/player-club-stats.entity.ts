import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Player } from './player.entity';
import { Club } from '../../clubs/entities/club.entity';

@Entity('player_club_stats')
@Index(['player', 'club'], { unique: true })
export class PlayerClubStats {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Player, player => player.clubStats)
    player: Player;

    @ManyToOne(() => Club)
    club: Club;

    @Column({ default: 0, type: 'int' })
    totalPoints: number;

    @Column({ default: 0, type: 'int' })
    leaguePoints: number;

    @Column({ default: 0, type: 'int' })
    tournamentPoints: number;

    @Column({ default: 0, type: 'int' })
    matchesWon: number;

    @Column({ default: 0, type: 'int' })
    matchesLost: number;

    @Column({ default: 0, type: 'int' })
    gamesWon: number;

    @Column({ default: 0, type: 'int' })
    gamesLost: number;

    @Column({ default: 0, type: 'int' })
    tournamentsPlayed: number;

    @Column({ default: 0, type: 'int' })
    leaguesPlayed: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
