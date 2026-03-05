import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Reservation } from '../../courts/entities/reservation.entity';

export enum MercadoPagoPaymentStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    CANCELLED = 'cancelled',
    REFUNDED = 'refunded',
    IN_PROCESS = 'in_process',
}

@Entity('mercadopago_payments')
export class MercadoPagoPayment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** Reservation this payment is for */
    @ManyToOne(() => Reservation, { onDelete: 'CASCADE', nullable: true })
    reservation: Reservation;

    @Column({ nullable: true })
    reservationId: string;

    /** Club that receives the payment */
    @Column()
    clubId: string;

    /** Mercado Pago preference ID (for Checkout Pro/Bricks) */
    @Column({ nullable: true })
    preferenceId: string;

    /** Mercado Pago payment ID (after payment is made) */
    @Column({ nullable: true })
    mpPaymentId: string;

    /** External reference for correlation */
    @Column({ unique: true })
    externalReference: string;

    /** Amount in CLP */
    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    /** Currency */
    @Column({ default: 'CLP' })
    currency: string;

    /** Description */
    @Column({ nullable: true })
    description: string;

    /** Payer email */
    @Column({ nullable: true })
    payerEmail: string;

    /** Player index for per-player payments (0-3), null for full-court */
    @Column({ type: 'int', nullable: true })
    playerIndex: number;

    /** Player name for per-player payments */
    @Column({ nullable: true })
    playerName: string;

    /** Player ID (from players table) for per-player payments */
    @Column({ nullable: true })
    playerId: string;

    /** Status from Mercado Pago */
    @Column({
        type: 'enum',
        enum: MercadoPagoPaymentStatus,
        default: MercadoPagoPaymentStatus.PENDING,
    })
    status: MercadoPagoPaymentStatus;

    /** Status detail from MP */
    @Column({ nullable: true })
    statusDetail: string;

    /** Payment method (visa, master, etc.) */
    @Column({ nullable: true })
    paymentMethod: string;

    /** Full MP webhook payload for debugging */
    @Column({ type: 'jsonb', nullable: true })
    mpData: any;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
