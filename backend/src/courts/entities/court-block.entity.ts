import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum BlockType {
    FULL_DAY = 'full_day',
    MORNING = 'morning',      // 07:00 - 12:00
    AFTERNOON = 'afternoon',  // 12:00 - 18:00
    NIGHT = 'night',          // 18:00 - 23:30
    CUSTOM = 'custom',        // customStartTime - customEndTime
}

@Entity('court_blocks')
export class CourtBlock {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    clubId: string;

    @Column({ type: 'date' })
    startDate: string;

    @Column({ type: 'date' })
    endDate: string;

    @Column({ type: 'enum', enum: BlockType, default: BlockType.FULL_DAY })
    blockType: BlockType;

    @Column({ nullable: true })
    customStartTime: string; // "08:00"

    @Column({ nullable: true })
    customEndTime: string; // "12:00"

    /** null = all courts, otherwise specific court IDs */
    @Column({ type: 'jsonb', nullable: true })
    courtIds: string[] | null;

    @Column({ default: '' })
    reason: string;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
