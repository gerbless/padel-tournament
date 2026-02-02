import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Player } from '../../players/entities/player.entity';
import { User } from '../../users/entities/user.entity';
import { Club } from '../../clubs/entities/club.entity';

@Entity('personal_matches')
export class PersonalMatch {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    date: Date;

    // The user who owns this record
    @ManyToOne(() => User)
    @JoinColumn({ name: 'ownerId' })
    owner: User;

    @Column()
    ownerId: string;

    // Teammate
    @ManyToOne(() => Player)
    @JoinColumn({ name: 'partnerId' })
    partner: Player;

    @Column()
    partnerId: string;

    // Rivals
    @ManyToOne(() => Player)
    @JoinColumn({ name: 'rival1Id' })
    rival1: Player;

    @Column()
    rival1Id: string;

    @ManyToOne(() => Player)
    @JoinColumn({ name: 'rival2Id' })
    rival2: Player;

    @Column()
    rival2Id: string;

    // Club (optional)
    @ManyToOne(() => Club, { nullable: true })
    @JoinColumn({ name: 'clubId' })
    club: Club;

    @Column({ nullable: true })
    clubId: string;

    // Score stored as JSON
    // Format: [{ "set": 1, "myScore": 6, "rivalScore": 4, "tieBreak": false }, ...]
    @Column('jsonb')
    sets: any[];

    @Column({ type: 'enum', enum: ['win', 'loss'] })
    result: 'win' | 'loss';

    @CreateDateColumn()
    createdAt: Date;
}
