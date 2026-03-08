import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany } from 'typeorm';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { League } from '../../leagues/entities/league.entity';
import { Player } from '../../players/entities/player.entity';
import { Court } from '../../courts/entities/court.entity';

@Entity('clubs')
export class Club {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    description?: string;

    @Column({ nullable: true })
    logo?: string;

    /** PostgreSQL schema name for this club's tenant data. Auto-generated on creation. */
    @Column({ nullable: true, unique: true })
    schemaName: string;

    /** When false, the club is hidden from non-super_admin users. */
    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: false })
    enableCourtPricing: boolean;

    /** Allow admins to send Mercado Pago payment links via Email/WhatsApp */
    @Column({ default: false })
    enablePaymentLinkSending: boolean;

    /** Master switch: when false, ALL Mercado Pago payment UI is hidden across the entire app */
    @Column({ default: true })
    enablePayments: boolean;

    /** Require WhatsApp OTP verification during player registration */
    @Column({ default: false })
    enablePhoneVerification: boolean;

    /**
     * Per-club integration credentials (SMTP, Twilio, MercadoPago).
     * Stored as encrypted-at-rest JSONB. Only returnable via the super_admin credentials endpoint.
     * Secrets are NEVER included in the standard GET /clubs/:id response.
     */
    @Column({ type: 'jsonb', nullable: true, default: null, select: false })
    credentials: {
        smtp?: { host: string; port: number; user: string; pass: string; from: string; };
        twilio?: { accountSid: string; authToken: string; whatsappFrom: string; };
        mercadopago?: { accessToken: string; publicKey: string; notificationUrl?: string; };
    } | null;

    /**
     * Bank transfer details shown to players when Mercado Pago is disabled.
     * Contains bank name, account holder, account number, etc.
     */
    @Column({ type: 'jsonb', nullable: true, default: null })
    transferInfo: {
        bankName?: string;
        accountHolder?: string;
        accountType?: string;
        accountNumber?: string;
        rut?: string;
        email?: string;
        notes?: string;
    } | null;

    /** Points awarded per free-play match win (configurable per club) */
    @Column({ type: 'int', default: 3 })
    freePlayPointsPerWin: number;

    /**
     * Per-club module visibility configuration.
     * Admins toggle which modules are active for their club.
     */
    @Column({
        type: 'jsonb',
        default: {
            dashboard: true,
            tournaments: true,
            leagues: true,
            courts: true,
            players: true,
            ranking: true,
            estadisticas: true,
        },
    })
    enabledModules: {
        dashboard: boolean;
        tournaments: boolean;
        leagues: boolean;
        courts: boolean;
        players: boolean;
        ranking: boolean;
        estadisticas: boolean;
    };

    // Relations
    @OneToMany(() => Tournament, tournament => tournament.club)
    tournaments: Tournament[];

    @OneToMany(() => League, league => league.club)
    leagues: League[];

    @OneToMany(() => Court, court => court.club)
    courts: Court[];

    @ManyToMany(() => Player, player => player.clubs)
    players: Player[];
}
