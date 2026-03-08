import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { Reservation } from './reservation.entity';
import { Club } from '../../clubs/entities/club.entity';

@Entity('free_play_matches')
@Index(['reservationId'], { unique: true })
export class FreePlayMatch {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Reservation, { onDelete: 'CASCADE' })
    reservation: Reservation;

    @Column()
    reservationId: string;

    @ManyToOne(() => Club, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
    club: Club;

    @Column()
    clubId: string;

    @Column({ type: 'date' })
    date: string;

    /** Team 1: player IDs (from players table) */
    @Column({ type: 'jsonb' })
    team1PlayerIds: string[];

    /** Team 2: player IDs (from players table) */
    @Column({ type: 'jsonb' })
    team2PlayerIds: string[];

    /** Team 1 player names (denormalized for display) */
    @Column({ type: 'jsonb' })
    team1Names: string[];

    /** Team 2 player names (denormalized for display) */
    @Column({ type: 'jsonb' })
    team2Names: string[];

    /**
     * Score: array of sets, e.g. [{ team1: 6, team2: 4 }, { team1: 3, team2: 6 }, { team1: 7, team2: 5 }]
     */
    @Column({ type: 'jsonb', default: [] })
    sets: { team1: number; team2: number }[];

    /** Which team won: 1, 2, or null if not yet completed */
    @Column({ type: 'int', nullable: true })
    winner: number | null;

    /** Whether this match counts for ranking */
    @Column({ default: true })
    countsForRanking: boolean;

    /** Points awarded per win (snapshot from club config at time of recording) */
    @Column({ type: 'int', default: 3 })
    pointsPerWin: number;

    @Column({
        type: 'varchar',
        default: 'completed',
    })
    status: 'pending' | 'completed';

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
