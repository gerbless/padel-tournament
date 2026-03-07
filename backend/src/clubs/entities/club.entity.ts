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

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: false })
    enableCourtPricing: boolean;

    /** Allow admins to send Mercado Pago payment links via Email/WhatsApp */
    @Column({ default: false })
    enablePaymentLinkSending: boolean;

    /** Require WhatsApp OTP verification during player registration */
    @Column({ default: false })
    enablePhoneVerification: boolean;

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
