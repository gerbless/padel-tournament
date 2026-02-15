import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Player } from '../../players/entities/player.entity';
import { UserClubRole } from './user-club-role.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    /** Global role: 'super_admin' | 'user' */
    @Column({ default: 'user' })
    role: string;

    @OneToOne(() => Player, { nullable: true })
    @JoinColumn()
    player: Player;

    @Column({ nullable: true })
    playerId: string;

    @OneToMany(() => UserClubRole, (ucr) => ucr.user)
    clubRoles: UserClubRole[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
