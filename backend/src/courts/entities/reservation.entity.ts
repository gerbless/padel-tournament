import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Court } from './court.entity';
import { Club } from '../../clubs/entities/club.entity';

export enum ReservationStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    CANCELLED = 'cancelled'
}

export enum PriceType {
    FULL_COURT = 'full_court',
    PER_PLAYER = 'per_player'
}

export enum PaymentStatus {
    PENDING = 'pending',
    PAID = 'paid',
    PARTIAL = 'partial'
}

export enum PaymentMethod {
    CASH = 'cash',
    TRANSFER = 'transfer',
    MERCADO_PAGO = 'mercado_pago',
    RED_COMPRAS = 'red_compras'
}

@Entity('reservations')
export class Reservation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Court, court => court.reservations, { onDelete: 'CASCADE' })
    court: Court;

    @Column()
    courtId: string;

    @ManyToOne(() => Club, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
    club: Club;

    @Column()
    clubId: string;

    @Column({ type: 'date' })
    date: string;

    @Column()
    startTime: string; // "08:00"

    @Column()
    endTime: string; // "09:30"

    @Column({ nullable: true })
    title: string;

    @Column({
        type: 'enum',
        enum: ReservationStatus,
        default: ReservationStatus.CONFIRMED
    })
    status: ReservationStatus;

    @Column({ type: 'jsonb', default: [] })
    players: string[]; // Player names

    @Column({ default: 4 })
    playerCount: number;

    @Column({
        type: 'enum',
        enum: PriceType,
        default: PriceType.FULL_COURT
    })
    priceType: PriceType;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    basePrice: number; // From price block

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    finalPrice: number; // Can be overridden

    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING
    })
    paymentStatus: PaymentStatus;

    @Column({ type: 'text', nullable: true })
    paymentNotes: string;

    /** Payment method for full-court payments */
    @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
    paymentMethod: PaymentMethod;

    @Column({ type: 'jsonb', nullable: true })
    playerPayments: { playerId?: string; playerName: string; paid: boolean; amount: number; paymentMethod?: string }[];

    /** Deadline for payment — if not paid by this time, reservation is auto-cancelled */
    @Column({ type: 'timestamptz', nullable: true })
    paymentExpiresAt: Date;

    /** Whether this reservation's match counts for the free-play ranking */
    @Column({ default: false })
    countsForRanking: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
