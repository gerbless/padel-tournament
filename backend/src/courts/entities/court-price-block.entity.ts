import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Court } from './court.entity';

@Entity('court_price_blocks')
export class CourtPriceBlock {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Court, court => court.priceBlocks, { onDelete: 'CASCADE' })
    court: Court;

    @Column()
    courtId: string;

    @Column({ type: 'jsonb', default: [] })
    daysOfWeek: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday

    @Column()
    startTime: string; // "08:00"

    @Column()
    endTime: string; // "10:00"

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    priceFullCourt: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    pricePerPlayer: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
