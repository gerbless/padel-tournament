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
