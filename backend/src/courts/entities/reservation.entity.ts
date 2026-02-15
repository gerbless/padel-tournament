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

@Entity('reservations')
export class Reservation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Court, court => court.reservations, { onDelete: 'CASCADE' })
    court: Court;

    @Column()
    courtId: string;

    @ManyToOne(() => Club, { onDelete: 'CASCADE' })
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

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
