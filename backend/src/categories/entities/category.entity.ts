import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Player } from '../../players/entities/player.entity';

@Entity('categories')
export class Category {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

    @Column({ comment: 'Level 1 is highest, Level 2 lower, etc.' })
    level: number;

    @Column({ default: 0 })
    minPoints: number;

    @Column({ default: 0 })
    maxPoints: number;

    @OneToMany(() => Player, player => player.category)
    players: Player[];
}
