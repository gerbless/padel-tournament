import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Club } from '../../clubs/entities/club.entity';
import { CourtPriceBlock } from './court-price-block.entity';
import { Reservation } from './reservation.entity';

@Entity('courts')
export class Court {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Club, { onDelete: 'CASCADE' })
    club: Club;

    @Column()
    clubId: string;

    @Column()
    name: string;

    @Column()
    courtNumber: number;

    @Column({ nullable: true })
    surfaceType: string;

    @Column({ default: true })
    isActive: boolean;

    @OneToMany(() => CourtPriceBlock, block => block.court, { cascade: true })
    priceBlocks: CourtPriceBlock[];

    @OneToMany(() => Reservation, reservation => reservation.court)
    reservations: Reservation[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
